#!/bin/bash

# Voice Interaction Pipeline - Jetson Nano Orin Initialization Script
# This script sets up the voice pipeline system on Jetson Nano Orin hardware

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/voice-pipeline-init.log"
MODELS_DIR="$PROJECT_ROOT/models"
CONFIG_DIR="$PROJECT_ROOT/config"
SERVICE_NAME="voice-pipeline"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_error "This script should not be run as root for security reasons"
        log "Please run as a regular user with sudo privileges"
        exit 1
    fi
}

# Check if running on Jetson Nano Orin
check_jetson_hardware() {
    log "Checking Jetson Nano Orin hardware compatibility..."
    
    if [ ! -f /etc/nv_tegra_release ]; then
        log_error "This script is designed for NVIDIA Jetson devices"
        log_error "Jetson hardware not detected"
        exit 1
    fi
    
    # Check for Orin specifically
    if grep -q "Orin" /proc/device-tree/model 2>/dev/null; then
        log_success "Jetson Nano Orin detected"
    else
        log_warning "Jetson device detected but may not be Nano Orin"
        log "Continuing with installation..."
    fi
    
    # Check available memory
    TOTAL_MEM=$(free -m | awk 'NR==2{printf "%.0f", $2}')
    if [ "$TOTAL_MEM" -lt 7000 ]; then
        log_error "Insufficient memory detected: ${TOTAL_MEM}MB"
        log_error "Voice pipeline requires at least 8GB RAM"
        exit 1
    fi
    
    log_success "Memory check passed: ${TOTAL_MEM}MB available"
}

# Install system dependencies
install_dependencies() {
    log "Installing system dependencies..."
    
    # Update package list
    sudo apt-get update
    
    # Install required packages
    sudo apt-get install -y \
        curl \
        wget \
        git \
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
        python3-venv \
        nodejs \
        npm \
        ffmpeg \
        sox \
        portaudio19-dev \
        libportaudio2 \
        libjack-jackd2-dev
    
    log_success "System dependencies installed"
}

# Setup CUDA and TensorRT for Jetson
setup_cuda_tensorrt() {
    log "Setting up CUDA and TensorRT for Jetson..."
    
    # Check if CUDA is already installed
    if command -v nvcc &> /dev/null; then
        CUDA_VERSION=$(nvcc --version | grep "release" | awk '{print $6}' | cut -c2-)
        log_success "CUDA already installed: version $CUDA_VERSION"
    else
        log_warning "CUDA not found in PATH"
        log "CUDA should be pre-installed on Jetson devices"
    fi
    
    # Set CUDA environment variables
    echo 'export PATH=/usr/local/cuda/bin:$PATH' >> ~/.bashrc
    echo 'export LD_LIBRARY_PATH=/usr/local/cuda/lib64:$LD_LIBRARY_PATH' >> ~/.bashrc
    echo 'export CUDA_HOME=/usr/local/cuda' >> ~/.bashrc
    
    # Check TensorRT
    if [ -d "/usr/include/aarch64-linux-gnu" ] && [ -f "/usr/include/aarch64-linux-gnu/NvInfer.h" ]; then
        log_success "TensorRT headers found"
    else
        log_warning "TensorRT headers not found in expected location"
    fi
    
    log_success "CUDA/TensorRT setup completed"
}

# Install Node.js dependencies
install_node_dependencies() {
    log "Installing Node.js dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Install npm dependencies
    npm install
    
    # Install additional audio processing libraries
    npm install --save \
        node-record-lpcm16 \
        speaker \
        wav \
        node-opus \
        @tensorflow/tfjs-node-gpu
    
    log_success "Node.js dependencies installed"
}

# Create necessary directories
create_directories() {
    log "Creating necessary directories..."
    
    mkdir -p "$MODELS_DIR"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$PROJECT_ROOT/logs"
    mkdir -p "$PROJECT_ROOT/temp"
    mkdir -p "$PROJECT_ROOT/cache"
    
    # Set appropriate permissions
    chmod 755 "$MODELS_DIR"
    chmod 755 "$CONFIG_DIR"
    chmod 755 "$PROJECT_ROOT/logs"
    chmod 755 "$PROJECT_ROOT/temp"
    chmod 755 "$PROJECT_ROOT/cache"
    
    log_success "Directories created"
}

# Download and validate AI models
download_models() {
    log "Downloading AI models..."
    
    cd "$MODELS_DIR"
    
    # Create model download script
    cat > download_models.sh << 'EOF'
#!/bin/bash

# Model URLs (these would be actual URLs in production)
WAKE_WORD_URL="https://example.com/models/wake-word-jetson.onnx"
WHISPER_URL="https://example.com/models/whisper-base-jetson.onnx"
INTENT_URL="https://example.com/models/intent-classifier-jetson.onnx"
TTS_URL="https://example.com/models/tts-jetson.onnx"

# Download function with retry
download_with_retry() {
    local url=$1
    local output=$2
    local max_attempts=3
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        echo "Downloading $output (attempt $attempt/$max_attempts)..."
        if wget -O "$output" "$url"; then
            echo "Successfully downloaded $output"
            return 0
        else
            echo "Download failed for $output (attempt $attempt)"
            rm -f "$output"
            ((attempt++))
            sleep 5
        fi
    done
    
    echo "Failed to download $output after $max_attempts attempts"
    return 1
}

# Download models (commented out as URLs are placeholders)
# download_with_retry "$WAKE_WORD_URL" "wake-word-prod.onnx"
# download_with_retry "$WHISPER_URL" "whisper-base-prod.onnx"
# download_with_retry "$INTENT_URL" "intent-classifier-prod.onnx"
# download_with_retry "$TTS_URL" "tts-prod.onnx"

# Create placeholder models for testing
echo "Creating placeholder model files..."
touch wake-word-prod.onnx
touch whisper-base-prod.onnx
touch intent-classifier-prod.onnx
touch tts-prod.onnx

echo "Model download completed"
EOF
    
    chmod +x download_models.sh
    ./download_models.sh
    
    log_success "AI models downloaded"
}

# Validate model integrity
validate_models() {
    log "Validating model integrity..."
    
    cd "$MODELS_DIR"
    
    # List of required models
    REQUIRED_MODELS=(
        "wake-word-prod.onnx"
        "whisper-base-prod.onnx"
        "intent-classifier-prod.onnx"
        "tts-prod.onnx"
    )
    
    for model in "${REQUIRED_MODELS[@]}"; do
        if [ -f "$model" ]; then
            # Check file size (should be > 0)
            if [ -s "$model" ]; then
                log_success "Model validated: $model"
            else
                log_error "Model file is empty: $model"
                exit 1
            fi
        else
            log_error "Required model not found: $model"
            exit 1
        fi
    done
    
    log_success "All models validated"
}

# Setup audio system
setup_audio() {
    log "Setting up audio system..."
    
    # Add user to audio group
    sudo usermod -a -G audio "$USER"
    
    # Configure ALSA
    cat > ~/.asoundrc << 'EOF'
pcm.!default {
    type pulse
}
ctl.!default {
    type pulse
}
EOF
    
    # Test audio devices
    log "Available audio devices:"
    aplay -l || log_warning "No audio playback devices found"
    arecord -l || log_warning "No audio capture devices found"
    
    log_success "Audio system configured"
}

# Create systemd service
create_service() {
    log "Creating systemd service..."
    
    # Create service file
    sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null << EOF
[Unit]
Description=Voice Interaction Pipeline
After=network.target sound.target
Wants=network.target

[Service]
Type=simple
User=$USER
Group=$USER
WorkingDirectory=$PROJECT_ROOT
Environment=NODE_ENV=production
Environment=CUDA_VISIBLE_DEVICES=0
ExecStart=/usr/bin/node dist/index.js
ExecReload=/bin/kill -HUP \$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=$SERVICE_NAME

# Resource limits for Jetson Nano Orin
MemoryMax=6G
CPUQuota=600%

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$PROJECT_ROOT/logs $PROJECT_ROOT/temp $PROJECT_ROOT/cache
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable ${SERVICE_NAME}.service
    
    log_success "Systemd service created and enabled"
}

# Setup monitoring and health checks
setup_monitoring() {
    log "Setting up monitoring and health checks..."
    
    # Create health check script
    cat > "$PROJECT_ROOT/scripts/health-check.sh" << 'EOF'
#!/bin/bash

# Voice Pipeline Health Check Script

SERVICE_NAME="voice-pipeline"
LOG_FILE="/var/log/voice-pipeline-health.log"
MAX_MEMORY_MB=6144  # 6GB limit for Jetson Nano Orin
MAX_CPU_PERCENT=80

log_health() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check service status
if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    log_health "ERROR: Service $SERVICE_NAME is not running"
    exit 1
fi

# Check memory usage
MEMORY_USAGE=$(ps -o pid,vsz,comm -C node | grep -E "(node|voice)" | awk '{sum+=$2} END {print sum/1024}')
if (( $(echo "$MEMORY_USAGE > $MAX_MEMORY_MB" | bc -l) )); then
    log_health "WARNING: High memory usage: ${MEMORY_USAGE}MB"
fi

# Check CPU usage
CPU_USAGE=$(ps -o pid,pcpu,comm -C node | grep -E "(node|voice)" | awk '{sum+=$2} END {print sum}')
if (( $(echo "$CPU_USAGE > $MAX_CPU_PERCENT" | bc -l) )); then
    log_health "WARNING: High CPU usage: ${CPU_USAGE}%"
fi

# Check audio devices
if ! aplay -l &>/dev/null; then
    log_health "ERROR: No audio playback devices available"
fi

if ! arecord -l &>/dev/null; then
    log_health "ERROR: No audio capture devices available"
fi

log_health "Health check completed successfully"
EOF
    
    chmod +x "$PROJECT_ROOT/scripts/health-check.sh"
    
    # Create cron job for health checks
    (crontab -l 2>/dev/null; echo "*/5 * * * * $PROJECT_ROOT/scripts/health-check.sh") | crontab -
    
    log_success "Monitoring and health checks configured"
}

# Setup log rotation
setup_log_rotation() {
    log "Setting up log rotation..."
    
    sudo tee /etc/logrotate.d/voice-pipeline > /dev/null << EOF
$PROJECT_ROOT/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
    maxsize 100M
}

/var/log/voice-pipeline*.log {
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

# Optimize system for voice processing
optimize_system() {
    log "Optimizing system for voice processing..."
    
    # Set CPU governor to performance
    echo 'GOVERNOR="performance"' | sudo tee /etc/default/cpufrequtils
    
    # Increase audio buffer sizes
    echo 'options snd-hda-intel model=generic' | sudo tee -a /etc/modprobe.d/alsa-base.conf
    
    # Set real-time priorities for audio
    echo '@audio - rtprio 95' | sudo tee -a /etc/security/limits.conf
    echo '@audio - memlock unlimited' | sudo tee -a /etc/security/limits.conf
    
    # Optimize network settings for low latency
    echo 'net.core.rmem_max = 16777216' | sudo tee -a /etc/sysctl.conf
    echo 'net.core.wmem_max = 16777216' | sudo tee -a /etc/sysctl.conf
    
    log_success "System optimization completed"
}

# Build the project
build_project() {
    log "Building voice pipeline project..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies if not already done
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # Build TypeScript
    npm run build
    
    # Verify build output
    if [ ! -f "dist/index.js" ]; then
        log_error "Build failed - dist/index.js not found"
        exit 1
    fi
    
    log_success "Project built successfully"
}

# Main installation function
main() {
    log "Starting Voice Interaction Pipeline installation on Jetson Nano Orin..."
    
    check_root
    check_jetson_hardware
    install_dependencies
    setup_cuda_tensorrt
    create_directories
    install_node_dependencies
    download_models
    validate_models
    setup_audio
    build_project
    create_service
    setup_monitoring
    setup_log_rotation
    optimize_system
    
    log_success "Installation completed successfully!"
    log ""
    log "Next steps:"
    log "1. Reboot the system to apply all changes"
    log "2. Start the service: sudo systemctl start $SERVICE_NAME"
    log "3. Check service status: sudo systemctl status $SERVICE_NAME"
    log "4. View logs: journalctl -u $SERVICE_NAME -f"
    log ""
    log "Configuration files are located in: $CONFIG_DIR"
    log "Logs are located in: $PROJECT_ROOT/logs"
    log "Health check logs: /var/log/voice-pipeline-health.log"
}

# Run main function
main "$@"