# JetPack 5 Deployment Troubleshooting Guide

## Quick Fix for JetPack 5 Issues

If you're getting errors with the standard deployment script on JetPack 5, use the JetPack 5 specific deployment:

### Windows Users
```powershell
.\deployment\deploy-jetpack5.ps1 -JetsonHost your-jetson-ip -JetsonUser your-username
```

### Linux/WSL Users
```bash
bash deployment/deploy-jetson-jetpack5.sh
```

## Common JetPack 5 Issues and Solutions

### 1. Docker Base Image Compatibility

**Problem:** Container fails to start with base image errors
```
Error: failed to create shim: OCI runtime create failed
```

**Solution:** Use JetPack 5 specific configuration
```bash
# Use the JetPack 5 specific Docker Compose file
docker compose -f deployment/docker-compose.jetpack5.yml up -d
```

### 2. CUDA Version Mismatch

**Problem:** CUDA 12.x libraries not found (JetPack 5 uses CUDA 11.4)
```
Error: CUDA driver version is insufficient for CUDA runtime version
```

**Solution:** Verify JetPack 5 CUDA version
```bash
# On Jetson device
nvidia-smi
cat /usr/local/cuda/version.txt

# Should show CUDA 11.4 for JetPack 5
```

### 3. Memory Issues on JetPack 5

**Problem:** Out of memory during build or runtime
```
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solutions:**
```bash
# 1. Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# 2. Add swap space on Jetson
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 3. Use the JetPack 5 resource limits
# (Already configured in docker-compose.jetpack5.yml)
```

### 4. TensorRT Version Issues

**Problem:** TensorRT 10.x not available (JetPack 5 uses TensorRT 8.5)
```
Error: TensorRT version mismatch
```

**Solution:** Use JetPack 5 compatible versions
```dockerfile
# In Dockerfile.jetson-jetpack5 (already configured)
ENV TENSORRT_VERSION=8.5
ENV CUDA_VERSION=11.4
```

### 5. Node.js Version Compatibility

**Problem:** Node.js 20+ features not working on JetPack 5
```
SyntaxError: Unexpected token
```

**Solution:** Use Node.js 18 LTS (configured in JetPack 5 files)
```bash
# Verify Node.js version on Jetson
node --version  # Should be v18.x
```

### 6. Audio System Issues on JetPack 5

**Problem:** Audio devices not accessible
```
ALSA lib pcm_dmix.c:1032:(snd_pcm_dmix_open) unable to open slave
```

**Solution:** Configure audio permissions
```bash
# On Jetson device
sudo usermod -a -G audio $USER
sudo systemctl restart pulseaudio

# Check audio devices
aplay -l
arecord -l
```

### 7. Docker Compose Version Issues

**Problem:** Docker Compose v2 syntax not supported
```
ERROR: Version in "./docker-compose.yml" is unsupported
```

**Solution:** Install Docker Compose Plugin
```bash
# On Jetson device
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Verify installation
docker compose version
```

### 8. NVIDIA Container Runtime Issues

**Problem:** NVIDIA runtime not available
```
docker: Error response from daemon: could not select device driver "nvidia"
```

**Solution:** Install NVIDIA Container Runtime for JetPack 5
```bash
# On Jetson device
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-runtime

# Configure Docker daemon
sudo mkdir -p /etc/docker
echo '{
    "default-runtime": "nvidia",
    "runtimes": {
        "nvidia": {
            "path": "nvidia-container-runtime",
            "runtimeArgs": []
        }
    }
}' | sudo tee /etc/docker/daemon.json

sudo systemctl restart docker
```

## JetPack 5 Specific Deployment Steps

### Step 1: Verify JetPack 5 Installation
```bash
# On Jetson device
cat /etc/nv_tegra_release
# Should show: R35 (release), REVISION: 4.1

nvidia-smi
# Should show CUDA Version: 11.4
```

### Step 2: Use JetPack 5 Deployment Files
```bash
# From your development machine
# Use the JetPack 5 specific files:
# - deployment/Dockerfile.jetson-jetpack5
# - deployment/docker-compose.jetpack5.yml
# - deployment/deploy-jetson-jetpack5.sh
```

### Step 3: Deploy with JetPack 5 Configuration
```bash
# Linux/WSL
bash deployment/deploy-jetson-jetpack5.sh

# Windows PowerShell
.\deployment\deploy-jetpack5.ps1
```

### Step 4: Verify Deployment
```bash
# Check container status
ssh your-user@jetson-ip "docker ps | grep jetson-home-assistant-jp5"

# Check logs
ssh your-user@jetson-ip "docker logs jetson-home-assistant-jp5"

# Test health endpoint
curl http://jetson-ip:3000/health
```

## Performance Optimization for JetPack 5

### 1. Set Performance Mode
```bash
# On Jetson device
sudo nvpmodel -m 0  # Maximum performance
sudo jetson_clocks   # Lock clocks to maximum
```

### 2. Optimize Memory Settings
```bash
# Increase swap if needed
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3. Monitor Resource Usage
```bash
# Monitor system resources
htop

# Monitor Docker container resources
docker stats jetson-home-assistant-jp5

# Monitor GPU usage
nvidia-smi -l 1
```

## Rollback to Working Configuration

If deployment fails, you can rollback:

### 1. Stop Failed Container
```bash
docker compose -f deployment/docker-compose.jetpack5.yml down
```

### 2. Remove Failed Images
```bash
docker rmi jetson-home-assistant-jp5 || true
```

### 3. Clean Up
```bash
docker system prune -f
```

### 4. Try Alternative Deployment
```bash
# Use the original deployment with manual fixes
docker compose -f deployment/docker-compose.jetson.yml up -d
```

## Getting Additional Help

### 1. Check System Information
```bash
# On Jetson device
sudo apt list --installed | grep -E "(cuda|tensorrt|docker)"
free -h
df -h
uname -a
```

### 2. Collect Logs
```bash
# Docker logs
docker logs jetson-home-assistant-jp5 > deployment-logs.txt

# System logs
journalctl -u docker > docker-system-logs.txt
```

### 3. Test Minimal Configuration
```bash
# Test basic NVIDIA container access
docker run --rm --runtime=nvidia nvidia/cuda:11.4-base-ubuntu20.04 nvidia-smi
```

## Success Indicators

Your deployment is successful when:

1. ✅ Container starts without errors
2. ✅ Health check endpoint responds: `curl http://jetson-ip:3000/health`
3. ✅ Web interface loads: `http://jetson-ip:8080`
4. ✅ GPU access works: `docker exec container-name nvidia-smi`
5. ✅ Memory usage < 6GB: `docker stats container-name`
6. ✅ Audio devices accessible: `docker exec container-name aplay -l`

## Contact Information

If you continue to experience issues:

1. Run the diagnostic script: `bash deployment/diagnose-deployment.sh`
2. Check the main troubleshooting guide: `deployment/TROUBLESHOOTING.md`
3. Verify your JetPack version matches the deployment configuration
4. Consider using the virtual deployment for testing: `node simple-jetson-test.js`

Remember: JetPack 5 uses different base images, CUDA versions, and system configurations than JetPack 6. Always use the JetPack 5 specific deployment files for best compatibility.