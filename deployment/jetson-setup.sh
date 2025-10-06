#!/bin/bash

# Jetson Nano Orin Setup Script
# Prepares the Jetson device for Home Assistant deployment

set -e

# Configuration
LOG_FILE="/var/log/jetson-setup.log"
MODELS_DIR="/opt/home-assistant/models"
CONFIG_DIR="/etc/home-assistant"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root"
    exit 1
fi

# Verify Jetson hardware
verify_jetson() {
    log "Verifying Jetson Nano Orin hardware..."
    
    if [ ! -f /etc/nv_tegra_release ]; then
        log_error "Not running on NVIDIA Jetson hardware"
        exit 1
    fi
    
    # Check memory
    TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    if [ "$TOTAL_MEM" -lt 7000 ]; then
        log_error "Insufficient memory: ${TOTAL_MEM}MB (requires 8GB)"
        exit 1
    fi
    
    log_success "Jetson Nano Orin verified with ${TOTAL_MEM}MB RAM"
}

# Update system packages
update_system() {
    log "Updating system packages..."
    
    apt-get update
    apt-get upgrade -y
    
    # Install essential packages
    apt-get install -y \
        curl \
        wget \
        git \
        htop \
        iotop \
        nvtop \
        build-essential \
        cmake \
        pkg-config \
        libasound2-dev \
        libpulse-dev \
        libsndfile1-dev \
        libfftw3-dev \
        libopenblas-dev \
        python3 \
        python3-pip \
        ffmpeg \
        sox \
        portaudio19-dev \
        libportaudio2 \
        libjack-jackd2-dev \
        ca-certificates \
        gnupg \
        lsb-release
    
    log_success "System packages updated"
}

# Install Docker
install_docker() {
    log "Installing Docker..."
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        log_success "Docker already installed"
        return
    fi
    
    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add user to docker group
    usermod -aG docker $SUDO_USER
    
    # Enable Docker service
    systemctl enable docker
    systemctl start docker
    
    log_success "Docker installed and configured"
}

# Install NVIDIA Container Toolkit
install_nvidia_docker() {
    log "Installing NVIDIA Container Toolkit..."
    
    # Add NVIDIA GPG key
    distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
        && curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
        && curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
            sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
            tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
    
    # Install NVIDIA Container Toolkit
    apt-get update
    apt-get install -y nvidia-container-toolkit
    
    # Configure Docker to use NVIDIA runtime
    nvidia-ctk runtime configure --runtime=docker
    systemctl restart docker
    
    log_success "NVIDIA Container Toolkit installed"
}

# Setup audio system
setup_audio() {
    log "Setting up audio system..."
    
    # Configure ALSA
    cat > /etc/asound.conf << 'EOF'
pcm.!default {
    type pulse
}
ctl.!default {
    type pulse
}
EOF
    
    # Configure PulseAudio for system-wide use
    cat > /etc/pulse/system.pa << 'EOF'
#!/usr/bin/pulseaudio -nF

# Load audio drivers
load-module module-alsa-sink
load-module module-alsa-source
load-module module-native-protocol-unix auth-anonymous=1 socket=/tmp/pulse-socket

# Set default sink and source
set-default-sink alsa_output.platform-sound.stereo-fallback
set-default-source alsa_input.platform-sound.stereo-fallback
EOF
    
    # Enable PulseAudio system service
    systemctl --global disable pulseaudio.service pulseaudio.socket
    systemctl enable pulseaudio.service
    
    log_success "Audio system configured"
}

# Create system directories
create_directories() {
    log "Creating system directories..."
    
    mkdir -p "$MODELS_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p /var/log/home-assistant
    mkdir -p /var/cache/home-assistant
    mkdir -p /tmp/home-assistant
    
    # Set permissions
    chown -R $SUDO_USER:$SUDO_USER "$MODELS_DIR"
    chown -R $SUDO_USER:$SUDO_USER "$CONFIG_DIR"
    chown -R $SUDO_USER:$SUDO_USER /var/log/home-assistant
    chown -R $SUDO_USER:$SUDO_USER /var/cache/home-assistant
    chown -R $SUDO_USER:$SUDO_USER /tmp/home-assistant
    
    log_success "System directories created"
}

# Optimize system performance
optimize_performance() {
    log "Optimizing system performance..."
    
    # Set CPU governor to performance
    echo 'GOVERNOR="performance"' > /etc/default/cpufrequtils
    
    # Increase file descriptor limits
    cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65536
* hard nofile 65536
* soft nproc 32768
* hard nproc 32768
EOF
    
    # Optimize network settings
    cat >> /etc/sysctl.conf << 'EOF'
# Network optimizations for real-time audio
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.core.netdev_max_backlog = 5000

# Memory management
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
EOF
    
    # Apply sysctl settings
    sysctl -p
    
    log_success "System performance optimized"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up system monitoring..."
    
    # Create monitoring script
    cat > /usr/local/bin/jetson-monitor.sh << 'EOF'
#!/bin/bash

# Jetson monitoring script
LOG_FILE="/var/log/jetson-monitor.log"

log_metrics() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# CPU temperature
CPU_TEMP=$(cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null | awk '{print $1/1000}' || echo "N/A")

# GPU temperature  
GPU_TEMP=$(cat /sys/class/thermal/thermal_zone1/temp 2>/dev/null | awk '{print $1/1000}' || echo "N/A")

# Memory usage
MEM_USAGE=$(free | awk 'NR==2{printf "%.1f", $3*100/$2}')

# CPU usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')

# Disk usage
DISK_USAGE=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')

log_metrics "CPU_TEMP=${CPU_TEMP}°C GPU_TEMP=${GPU_TEMP}°C MEM=${MEM_USAGE}% CPU=${CPU_USAGE}% DISK=${DISK_USAGE}%"

# Check for thermal throttling
if (( $(echo "$CPU_TEMP > 80" | bc -l) )); then
    log_metrics "WARNING: High CPU temperature: ${CPU_TEMP}°C"
fi

if (( $(echo "$GPU_TEMP > 80" | bc -l) )); then
    log_metrics "WARNING: High GPU temperature: ${GPU_TEMP}°C"
fi
EOF
    
    chmod +x /usr/local/bin/jetson-monitor.sh
    
    # Create cron job for monitoring
    echo "*/5 * * * * /usr/local/bin/jetson-monitor.sh" | crontab -u $SUDO_USER -
    
    log_success "System monitoring configured"
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    cat > /etc/logrotate.d/home-assistant << 'EOF'
/var/log/home-assistant/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
    maxsize 100M
}

/var/log/jetson-*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    maxsize 50M
}
EOF
    
    log_success "Log rotation configured"
}

# Main setup function
main() {
    log "Starting Jetson Nano Orin setup for Home Assistant..."
    
    verify_jetson
    update_system
    install_docker
    install_nvidia_docker
    setup_audio
    create_directories
    optimize_performance
    setup_monitoring
    setup_log_rotation
    
    log_success "Jetson setup completed successfully!"
    log ""
    log "System is ready for Home Assistant deployment"
    log "Reboot recommended to apply all changes"
}

main "$@"