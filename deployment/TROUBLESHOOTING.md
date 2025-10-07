# Jetson Deployment Troubleshooting Guide

## Common Issues and Solutions

### 1. Script Execution Errors

#### Problem: Permission denied when running deploy-jetson.sh
```bash
bash: ./deployment/deploy-jetson.sh: Permission denied
```

**Solution:**
```bash
chmod +x deployment/deploy-jetson.sh
./deployment/deploy-jetson.sh
```

#### Problem: Script not found or command not recognized
```bash
./deployment/deploy-jetson.sh: command not found
```

**Solution:**
```bash
# Run from project root directory
cd /path/to/your/project
bash deployment/deploy-jetson.sh
```

### 2. Network Connection Issues

#### Problem: Cannot reach Jetson device
```
[ERROR] Cannot reach Jetson at jetson-nano.local
```

**Solutions:**
1. **Check network connection:**
   ```bash
   ping jetson-nano.local
   # or use IP address
   ping 192.168.1.100
   ```

2. **Set custom hostname/IP:**
   ```bash
   export JETSON_HOST=192.168.1.100
   export JETSON_USER=your-username
   ./deployment/deploy-jetson.sh
   ```

3. **Find Jetson on network:**
   ```bash
   ./scripts/find-jetson.sh
   ```

### 3. SSH Connection Issues

#### Problem: SSH connection failed
```
[ERROR] Cannot SSH to jetson@jetson-nano.local
```

**Solutions:**
1. **Enable SSH on Jetson:**
   ```bash
   # On Jetson device
   sudo systemctl enable ssh
   sudo systemctl start ssh
   ```

2. **Set up SSH keys:**
   ```bash
   ssh-keygen -t rsa
   ssh-copy-id jetson@jetson-nano.local
   ```

3. **Test SSH manually:**
   ```bash
   ssh jetson@jetson-nano.local
   ```

### 4. Docker Issues

#### Problem: Docker not found on Jetson
```
[ERROR] Docker not found on Jetson device
```

**Solution - Install Docker on Jetson:**
```bash
# SSH to Jetson first
ssh jetson@jetson-nano.local

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get update
sudo apt-get install docker-compose-plugin

# Reboot to apply changes
sudo reboot
```

#### Problem: NVIDIA Docker runtime not available
```
docker: Error response from daemon: could not select device driver "nvidia"
```

**Solution - Install NVIDIA Container Toolkit:**
```bash
# On Jetson device
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### 5. Build Issues

#### Problem: TypeScript compilation fails
```
'tsc' is not recognized as an internal or external command
```

**Solution:**
```bash
# Install TypeScript globally or locally
npm install -g typescript
# or
npm install typescript --save-dev

# Then run build
npm run build
```

#### Problem: Missing dependencies
```
npm ERR! Cannot resolve dependency
```

**Solution:**
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run build
```

### 6. File Transfer Issues

#### Problem: SCP transfer fails
```
scp: Connection refused
```

**Solutions:**
1. **Check SSH service:**
   ```bash
   ssh jetson@jetson-nano.local "sudo systemctl status ssh"
   ```

2. **Check disk space on Jetson:**
   ```bash
   ssh jetson@jetson-nano.local "df -h"
   ```

3. **Use alternative transfer method:**
   ```bash
   # Use rsync instead
   rsync -avz --progress ./ jetson@jetson-nano.local:~/home-assistant/
   ```

### 7. Container Runtime Issues

#### Problem: Container fails to start
```
docker: Error response from daemon: OCI runtime create failed
```

**Solutions:**
1. **Check container logs:**
   ```bash
   ssh jetson@jetson-nano.local "docker logs jetson-home-assistant"
   ```

2. **Check system resources:**
   ```bash
   ssh jetson@jetson-nano.local "free -h && df -h"
   ```

3. **Restart Docker service:**
   ```bash
   ssh jetson@jetson-nano.local "sudo systemctl restart docker"
   ```

### 8. Audio Device Issues

#### Problem: Audio devices not accessible
```
ALSA lib pcm_dmix.c:1032:(snd_pcm_dmix_open) unable to open slave
```

**Solution:**
```bash
# On Jetson device
sudo usermod -a -G audio $USER
sudo reboot

# Check audio devices
aplay -l
arecord -l
```

### 9. Memory Issues

#### Problem: Out of memory during build
```
FATAL ERROR: Ineffective mark-compacts near heap limit
```

**Solutions:**
1. **Increase Node.js memory limit:**
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   npm run build
   ```

2. **Build on development machine:**
   ```bash
   # Build locally, then deploy
   npm run build
   ./deployment/deploy-jetson.sh
   ```

### 10. Port Conflicts

#### Problem: Port already in use
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**
```bash
# Check what's using the port
ssh jetson@jetson-nano.local "sudo netstat -tulpn | grep :3000"

# Stop conflicting service
ssh jetson@jetson-nano.local "sudo systemctl stop conflicting-service"

# Or use different ports in docker-compose.jetson.yml
```

## Quick Diagnostic Commands

### Check Jetson Status
```bash
# System info
ssh jetson@jetson-nano.local "uname -a && cat /etc/nv_tegra_release"

# Resource usage
ssh jetson@jetson-nano.local "free -h && df -h && nvidia-smi"

# Docker status
ssh jetson@jetson-nano.local "docker --version && docker-compose --version"

# Container status
ssh jetson@jetson-nano.local "docker ps -a"
```

### Application Health Check
```bash
# Test API endpoints
curl http://jetson-nano.local:3000/health
curl http://jetson-nano.local:3000/status

# Check web interface
curl -I http://jetson-nano.local:8080
```

## Alternative Deployment Methods

### Method 1: USB Installer
```bash
# Create USB installer
./deployment/create-usb-installer.sh -u /media/usb

# Then use USB on Jetson
sudo ./scripts/install.sh
```

### Method 2: Manual Deployment
```bash
# Build locally
npm run build

# Copy files manually
scp -r dist/ config/ package*.json jetson@jetson-nano.local:~/home-assistant/

# SSH and setup manually
ssh jetson@jetson-nano.local
cd ~/home-assistant
npm ci --production
node dist/index.js
```

### Method 3: IP-based Deployment
```bash
# Use IP address instead of hostname
./deployment/deploy-jetson-ip.sh -i 192.168.1.100 -u jetson
```

## Getting Help

If you're still experiencing issues:

1. **Check logs:**
   ```bash
   ssh jetson@jetson-nano.local "journalctl -u docker -f"
   ssh jetson@jetson-nano.local "docker logs jetson-home-assistant"
   ```

2. **Run diagnostics:**
   ```bash
   ./scripts/find-jetson.sh
   ./deployment/verify-deployment.sh
   ```

3. **Test virtual environment first:**
   ```bash
   node simple-jetson-test.js
   ```

4. **Check system requirements:**
   - Jetson Nano Orin with 8GB RAM
   - JetPack 5.1 or later
   - Docker and Docker Compose installed
   - SSH access enabled
   - Network connectivity

Remember to run the deployment script from the project root directory and ensure all prerequisites are met before deployment.