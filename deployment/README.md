# Jetson Nano Orin Deployment Guide

This guide walks you through deploying the Home Assistant to a Jetson Nano Orin device.

## Prerequisites

### Hardware Requirements
- **NVIDIA Jetson Nano Orin** with 8GB RAM
- **MicroSD card** (64GB+ recommended, Class 10 or better)
- **USB microphone** and **speakers/headphones**
- **Network connection** (Ethernet or WiFi)
- **Power supply** (USB-C, 15W minimum)

### Software Requirements
- **JetPack SDK 5.1+** (Ubuntu 20.04 L4T)
- **Docker** with NVIDIA Container Toolkit
- **SSH access** to the Jetson device

## Quick Start

### 1. Prepare Your Jetson Device

Flash JetPack to your Jetson Nano Orin:
```bash
# Download JetPack SDK from NVIDIA Developer website
# Flash using NVIDIA SDK Manager or balenaEtcher
```

Enable SSH and set up network access:
```bash
# On Jetson device
sudo systemctl enable ssh
sudo systemctl start ssh

# Set up WiFi if needed
sudo nmcli dev wifi connect "YourWiFiName" password "YourPassword"
```

### 2. Deploy from Development Machine

Set environment variables:
```bash
export JETSON_HOST="jetson-nano.local"  # or IP address
export JETSON_USER="jetson"             # or your username
```

Run the deployment script:
```bash
cd deployment
chmod +x deploy-jetson.sh
./deploy-jetson.sh
```

### 3. Verify Deployment

Check the service status:
```bash
ssh jetson@jetson-nano.local
docker ps
docker logs -f jetson-home-assistant
```

Access the web interface:
- Open browser to `http://jetson-nano.local:8080`
- API available at `http://jetson-nano.local:3000`

## Manual Deployment Steps

If you prefer to deploy manually or need to troubleshoot:

### 1. Transfer Files

```bash
# Create deployment package
cd /path/to/your/project
npm run build
tar -czf home-assistant-jetson.tar.gz dist/ config/ deployment/ package*.json

# Transfer to Jetson
scp home-assistant-jetson.tar.gz jetson@jetson-nano.local:~/
ssh jetson@jetson-nano.local
tar -xzf home-assistant-jetson.tar.gz
```

### 2. Setup Jetson Environment

```bash
# Run setup script
sudo ./deployment/jetson-setup.sh

# Download AI models
./deployment/download-models.sh --placeholder  # for development
# or
./deployment/download-models.sh --production   # for production
```

### 3. Build and Run with Docker

```bash
# Build Docker image
docker build -f deployment/Dockerfile.jetson -t jetson-home-assistant .

# Run with Docker Compose
docker-compose -f deployment/docker-compose.jetson.yml up -d

# Or run directly
docker run -d \
  --name jetson-home-assistant \
  --runtime nvidia \
  --device /dev/snd:/dev/snd \
  -p 3000:3000 \
  -p 8080:8080 \
  -v $(pwd)/config:/app/config:ro \
  -v $(pwd)/models:/app/models:ro \
  jetson-home-assistant
```

## Configuration

### Production Configuration

Edit `config/production.json` to customize:

```json
{
  "jetson": {
    "memory_limit_gb": 6,
    "cpu_cores": 6
  },
  "voice": {
    "wake_word": {
      "sensitivity": 0.7
    },
    "speech_recognition": {
      "language": "en-US"
    }
  },
  "safety": {
    "child_safety_enabled": true,
    "content_filter_level": "strict"
  }
}
```

### Audio Configuration

Test audio devices:
```bash
# List audio devices
aplay -l    # playback devices
arecord -l  # capture devices

# Test audio
speaker-test -t wav -c 2
arecord -d 5 test.wav && aplay test.wav
```

Configure audio in `config/production.json`:
```json
{
  "audio": {
    "input_device": "hw:1,0",
    "output_device": "hw:0,0",
    "sample_rate": 16000
  }
}
```

## Monitoring and Maintenance

### Health Monitoring

Check system health:
```bash
# Run health check
docker exec jetson-home-assistant node dist/health-check.js

# View health logs
docker exec jetson-home-assistant cat logs/health-check.json
```

### Performance Monitoring

Monitor resource usage:
```bash
# Docker stats
docker stats jetson-home-assistant

# System monitoring
htop
iotop
nvtop  # GPU monitoring
```

### Log Management

View application logs:
```bash
# Container logs
docker logs -f jetson-home-assistant

# Application logs
docker exec jetson-home-assistant tail -f logs/assistant.log

# System logs
journalctl -u docker -f
```

### Updates and Maintenance

Update the application:
```bash
# Redeploy with new version
./deployment/deploy-jetson.sh

# Or update manually
docker-compose -f deployment/docker-compose.jetson.yml pull
docker-compose -f deployment/docker-compose.jetson.yml up -d
```

Clean up old images:
```bash
docker system prune -f
docker image prune -f
```

## Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs
docker logs jetson-home-assistant

# Check system resources
free -h
df -h

# Restart Docker
sudo systemctl restart docker
```

**Audio not working:**
```bash
# Check audio devices
aplay -l
arecord -l

# Test PulseAudio
pulseaudio --check -v

# Restart audio services
sudo systemctl restart pulseaudio
```

**High memory usage:**
```bash
# Check memory usage
docker stats jetson-home-assistant

# Restart container with memory limit
docker run --memory=4g ...
```

**GPU not accessible:**
```bash
# Check NVIDIA runtime
docker run --rm --runtime=nvidia nvidia/cuda:11.4-base-ubuntu20.04 nvidia-smi

# Reinstall NVIDIA Container Toolkit
sudo apt-get install --reinstall nvidia-container-toolkit
sudo systemctl restart docker
```

### Performance Optimization

**Reduce memory usage:**
- Lower model precision (FP16 instead of FP32)
- Reduce batch sizes
- Enable model quantization
- Use smaller models

**Improve response time:**
- Enable TensorRT optimization
- Use hardware acceleration
- Optimize audio buffer sizes
- Reduce model complexity

**Temperature management:**
- Ensure proper cooling
- Monitor thermal throttling
- Reduce CPU/GPU frequencies if needed
- Use performance governor wisely

## Security Considerations

### Network Security
- Change default passwords
- Use SSH keys instead of passwords
- Configure firewall rules
- Enable automatic security updates

### Application Security
- Keep Docker images updated
- Use non-root containers
- Limit container capabilities
- Regular security audits

### Data Privacy
- Enable encryption for user data
- Configure data retention policies
- Implement secure logging
- Regular privacy audits

## Support and Resources

### Documentation
- [NVIDIA Jetson Documentation](https://docs.nvidia.com/jetson/)
- [Docker on Jetson](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)
- [JetPack SDK](https://developer.nvidia.com/embedded/jetpack)

### Community
- [NVIDIA Developer Forums](https://forums.developer.nvidia.com/c/agx-autonomous-machines/jetson-embedded-systems/)
- [Jetson Community Projects](https://github.com/dusty-nv/jetson-inference)

### Monitoring Tools
- [Jetson Stats](https://github.com/rbonghi/jetson_stats)
- [NVIDIA System Management Interface](https://developer.nvidia.com/nvidia-system-management-interface)

## License and Legal

This deployment is subject to:
- NVIDIA JetPack License Agreement
- Docker License Terms
- Individual component licenses (see package.json)
- Child safety and privacy regulations (COPPA, GDPR)

Ensure compliance with all applicable laws and regulations in your jurisdiction.