# Quick Deploy to Jetson Nano Orin

## 🚀 Quick Start (5 minutes)

### 1. Verify Your Setup
```powershell
# Run verification script
.\deployment\verify-deployment.ps1
```

### 2. Set Your Jetson Details
```powershell
# Replace with your Jetson's IP or hostname
$env:JETSON_HOST = "jetson-nano.local"  # or "192.168.1.100"
$env:JETSON_USER = "jetson"             # or your username
```

### 3. Deploy
```powershell
# Navigate to deployment folder
cd deployment

# Run deployment (this will take 10-15 minutes)
bash deploy-jetson.sh
```

### 4. Verify Deployment
```powershell
# Check if running
ssh jetson@jetson-nano.local "docker ps"

# View logs
ssh jetson@jetson-nano.local "docker logs -f jetson-home-assistant"
```

### 5. Access Your Assistant
- **Web Interface**: http://jetson-nano.local:8080
- **API Health Check**: http://jetson-nano.local:3000/health

---

## 🛠️ Manual Deployment (if automated fails)

### Step 1: Build Locally
```powershell
npm ci
npm run build
```

### Step 2: Create Package
```powershell
# Create deployment archive
tar -czf home-assistant-jetson.tar.gz dist/ config/ deployment/ package*.json
```

### Step 3: Transfer to Jetson
```powershell
# Copy files
scp home-assistant-jetson.tar.gz jetson@jetson-nano.local:~/

# SSH to Jetson
ssh jetson@jetson-nano.local

# Extract files
tar -xzf home-assistant-jetson.tar.gz
```

### Step 4: Setup Jetson
```bash
# On Jetson device
sudo ./deployment/jetson-setup.sh
```

### Step 5: Download Models
```bash
# Development models (faster)
./deployment/download-models.sh --placeholder

# Or production models (slower, requires internet)
./deployment/download-models.sh --production
```

### Step 6: Deploy with Docker
```bash
# Build and run
docker-compose -f deployment/docker-compose.jetson.yml up -d

# Check status
docker ps
docker logs jetson-home-assistant
```

---

## 🔧 Troubleshooting

### Common Issues

**"Cannot reach Jetson"**
```powershell
# Find your Jetson's IP
nmap -sn 192.168.1.0/24 | grep -i jetson

# Or check router admin panel
```

**"SSH connection failed"**
```bash
# Enable SSH on Jetson
sudo systemctl enable ssh
sudo systemctl start ssh

# Check SSH service
sudo systemctl status ssh
```

**"Docker not found"**
```bash
# Install Docker on Jetson
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**"Container won't start"**
```bash
# Check logs
docker logs jetson-home-assistant

# Check system resources
free -h
df -h

# Restart Docker
sudo systemctl restart docker
```

**"High memory usage"**
```bash
# Monitor resources
docker stats jetson-home-assistant

# Reduce memory limit in docker-compose.jetson.yml
# Change: memory: 6G to memory: 4G
```

### Performance Issues

**Slow response times:**
- Check CPU temperature: `cat /sys/class/thermal/thermal_zone*/temp`
- Monitor GPU usage: `tegrastats`
- Reduce model complexity in config/production.json

**Audio not working:**
```bash
# Test audio devices
aplay -l
arecord -l

# Test audio
speaker-test -t wav -c 2
arecord -d 5 test.wav && aplay test.wav
```

---

## 📊 Monitoring

### Health Checks
```bash
# Manual health check
docker exec jetson-home-assistant node dist/health-check.js

# View health logs
docker exec jetson-home-assistant cat logs/health-check.json
```

### System Monitoring
```bash
# Resource usage
htop
iotop
tegrastats  # Jetson-specific

# Docker stats
docker stats jetson-home-assistant

# Temperature monitoring
watch -n 1 'cat /sys/class/thermal/thermal_zone*/temp'
```

### Log Management
```bash
# Application logs
docker logs -f jetson-home-assistant

# System logs
journalctl -u docker -f

# Health check logs
tail -f /var/log/jetson-monitor.log
```

---

## 🔄 Updates

### Update Application
```powershell
# Redeploy with latest changes
.\deployment\deploy-jetson.sh
```

### Update System
```bash
# On Jetson
sudo apt update && sudo apt upgrade -y
sudo reboot
```

### Backup Data
```bash
# Backup user data
docker exec jetson-home-assistant tar -czf /tmp/backup.tar.gz /app/logs /app/cache
docker cp jetson-home-assistant:/tmp/backup.tar.gz ./backup-$(date +%Y%m%d).tar.gz
```

---

## 🆘 Emergency Recovery

### Reset Container
```bash
# Stop and remove container
docker stop jetson-home-assistant
docker rm jetson-home-assistant

# Restart with Docker Compose
docker-compose -f deployment/docker-compose.jetson.yml up -d
```

### Full System Reset
```bash
# Remove all containers and images
docker system prune -a -f

# Redeploy from scratch
./deployment/deploy-jetson.sh
```

### Factory Reset Jetson
1. Flash new JetPack image to SD card
2. Boot Jetson and complete setup
3. Run deployment script again

---

## 📞 Support

If you encounter issues:

1. **Check logs first**: `docker logs jetson-home-assistant`
2. **Run health check**: `docker exec jetson-home-assistant node dist/health-check.js`
3. **Check system resources**: `free -h && df -h`
4. **Verify network connectivity**: `ping google.com`
5. **Check Jetson temperature**: `tegrastats`

For detailed documentation, see `deployment/README.md`.