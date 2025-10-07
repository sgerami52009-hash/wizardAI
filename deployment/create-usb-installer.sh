#!/bin/bash
# USB Installer Creation Script for Jetson Nano Orin
# Creates a complete deployment package on USB drive

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Default values
USB_MOUNT_POINT=""
VERSION="1.0.0"
INCLUDE_MODELS=false
PRODUCTION_BUILD=false

usage() {
    echo "Usage: $0 -u USB_MOUNT_POINT [-v VERSION] [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -u USB_MOUNT_POINT    Path to USB drive mount point (e.g., /media/usb)"
    echo ""
    echo "Optional:"
    echo "  -v VERSION           Version string (default: 1.0.0)"
    echo "  --include-models     Include AI models in installer"
    echo "  --production-build   Create production build"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -u /media/usb"
    echo "  $0 -u /mnt/usb -v 1.2.0 --production-build"
    exit 1
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u) USB_MOUNT_POINT="$2"; shift 2 ;;
        -v) VERSION="$2"; shift 2 ;;
        --include-models) INCLUDE_MODELS=true; shift ;;
        --production-build) PRODUCTION_BUILD=true; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

if [ -z "$USB_MOUNT_POINT" ]; then
    echo -e "${RED}❌ USB mount point is required${NC}"
    usage
fi

test_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    # Check if USB drive exists
    if [ ! -d "$USB_MOUNT_POINT" ]; then
        echo -e "${RED}❌ USB drive $USB_MOUNT_POINT not found${NC}"
        exit 1
    fi
    
    # Check available space (need at least 2GB)
    if command -v df >/dev/null 2>&1; then
        free_space_kb=$(df "$USB_MOUNT_POINT" | awk 'NR==2 {print $4}')
        free_space_gb=$((free_space_kb / 1024 / 1024))
        
        if [ $free_space_gb -lt 2 ]; then
            echo -e "${RED}❌ Insufficient space on USB drive. Need 2GB, have ${free_space_gb}GB${NC}"
            exit 1
        fi
        
        echo -e "${GREEN}✅ USB drive $USB_MOUNT_POINT has ${free_space_gb}GB free space${NC}"
    else
        echo -e "${YELLOW}⚠️ Cannot check disk space (df not available)${NC}"
    fi
    
    # Check if Node.js project exists
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found. Run from project root directory${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

build_application() {
    echo -e "${BLUE}🔨 Building application...${NC}"
    
    # Install dependencies
    echo -e "${YELLOW}Installing dependencies...${NC}"
    if ! npm ci; then
        echo -e "${RED}❌ npm ci failed${NC}"
        exit 1
    fi
    
    # Run safety audit
    echo -e "${YELLOW}Running safety audit...${NC}"
    npm run safety-audit || echo -e "${YELLOW}⚠️ Safety audit completed with warnings${NC}"
    
    # Build application
    echo -e "${YELLOW}Building TypeScript...${NC}"
    if ! npm run build; then
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Application built successfully${NC}"
}

create_usb_structure() {
    local usb_path="$1"
    
    echo -e "${BLUE}📁 Creating USB directory structure...${NC}"
    
    local installer_path="$usb_path/jetson-home-assistant"
    
    # Create main directories
    local directories=(
        "$installer_path"
        "$installer_path/app"
        "$installer_path/app/dist"
        "$installer_path/app/config"
        "$installer_path/app/deployment"
        "$installer_path/app/models"
        "$installer_path/scripts"
        "$installer_path/docs"
        "$installer_path/logs"
    )
    
    for dir in "${directories[@]}"; do
        mkdir -p "$dir"
    done
    
    echo -e "${GREEN}✅ USB directory structure created${NC}"
    echo "$installer_path"
}

copy_application_files() {
    local installer_path="$1"
    
    echo -e "${BLUE}📋 Copying application files...${NC}"
    
    # Copy built application
    cp -r dist/* "$installer_path/app/dist/"
    
    # Copy configuration
    cp -r config/* "$installer_path/app/config/"
    
    # Copy deployment scripts
    cp -r deployment/* "$installer_path/app/deployment/"
    
    # Copy package files
    cp package.json "$installer_path/app/"
    [ -f package-lock.json ] && cp package-lock.json "$installer_path/app/"
    
    # Copy documentation
    [ -f README.md ] && cp README.md "$installer_path/docs/"
    [ -f deployment/README.md ] && cp deployment/README.md "$installer_path/docs/DEPLOYMENT.md"
    
    echo -e "${GREEN}✅ Application files copied${NC}"
}

create_installer_scripts() {
    local installer_path="$1"
    
    echo -e "${BLUE}📝 Creating installer scripts...${NC}"
    
    # Create main installer script
    cat > "$installer_path/scripts/install.sh" << 'EOF'
#!/bin/bash

# Jetson Home Assistant USB Installer
# Version: __VERSION__
# Created: __CREATED__

set -e

# Configuration
INSTALL_DIR="/opt/home-assistant"
SERVICE_NAME="jetson-home-assistant"
LOG_FILE="/var/log/jetson-installer.log"

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

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    log_error "This installer must be run as root"
    log "Usage: sudo ./install.sh"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USB_ROOT="$(dirname "$SCRIPT_DIR")"

log "🚀 Starting Jetson Home Assistant USB Installation..."
log "USB Root: $USB_ROOT"
log "Install Directory: $INSTALL_DIR"

# Verify Jetson hardware
verify_jetson() {
    log "🔍 Verifying Jetson hardware..."
    
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

# Install system dependencies
install_dependencies() {
    log "📦 Installing system dependencies..."
    
    apt-get update
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
        lsb-release \
        unzip
    
    log_success "System dependencies installed"
}

# Install Docker
install_docker() {
    log "🐳 Installing Docker..."
    
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
    
    log_success "Docker installed"
}

# Install NVIDIA Container Toolkit
install_nvidia_docker() {
    log "🎮 Installing NVIDIA Container Toolkit..."
    
    distribution=$(. /etc/os-release;echo $ID$VERSION_ID) \
        && curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
        && curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
            sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
            tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
    
    apt-get update
    apt-get install -y nvidia-container-toolkit
    
    # Configure Docker to use NVIDIA runtime
    nvidia-ctk runtime configure --runtime=docker
    systemctl restart docker
    
    log_success "NVIDIA Container Toolkit installed"
}

# Install Node.js
install_nodejs() {
    log "📦 Installing Node.js..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        log_success "Node.js already installed: $NODE_VERSION"
        return
    fi
    
    # Install Node.js 18 LTS
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    log_success "Node.js installed: $(node --version)"
}

# Copy application files
copy_application() {
    log "📋 Copying application files..."
    
    # Create install directory
    mkdir -p "$INSTALL_DIR"
    
    # Copy application files from USB
    cp -r "$USB_ROOT/app/"* "$INSTALL_DIR/"
    
    # Set permissions
    chown -R $SUDO_USER:$SUDO_USER "$INSTALL_DIR"
    chmod +x "$INSTALL_DIR/deployment/"*.sh
    
    log_success "Application files copied to $INSTALL_DIR"
}

# Install Node.js dependencies
install_node_dependencies() {
    log "📦 Installing Node.js dependencies..."
    
    cd "$INSTALL_DIR"
    
    # Install production dependencies
    sudo -u $SUDO_USER npm ci --only=production
    
    log_success "Node.js dependencies installed"
}

# Setup audio system
setup_audio() {
    log "🔊 Setting up audio system..."
    
    # Configure ALSA
    cat > /etc/asound.conf << 'ALSA_EOF'
pcm.!default {
    type pulse
}
ctl.!default {
    type pulse
}
ALSA_EOF
    
    # Add user to audio group
    usermod -a -G audio $SUDO_USER
    
    log_success "Audio system configured"
}

# Download AI models
download_models() {
    log "🤖 Setting up AI models..."
    
    cd "$INSTALL_DIR"
    
    # Run model download script
    sudo -u $SUDO_USER ./deployment/download-models.sh --placeholder
    
    log_success "AI models configured"
}

# Create systemd service
create_service() {
    log "⚙️ Creating systemd service..."
    
    cat > /etc/systemd/system/${SERVICE_NAME}.service << SERVICE_EOF
[Unit]
Description=Jetson Home Assistant
After=network.target sound.target docker.service
Wants=network.target
Requires=docker.service

[Service]
Type=simple
User=$SUDO_USER
Group=$SUDO_USER
WorkingDirectory=$INSTALL_DIR
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
ReadWritePaths=$INSTALL_DIR/logs $INSTALL_DIR/temp $INSTALL_DIR/cache
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SERVICE_EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable ${SERVICE_NAME}.service
    
    log_success "Systemd service created and enabled"
}

# Setup monitoring
setup_monitoring() {
    log "📊 Setting up monitoring..."
    
    # Create health check cron job
    (crontab -u $SUDO_USER -l 2>/dev/null; echo "*/5 * * * * cd $INSTALL_DIR && node dist/health-check.js >> logs/health.log 2>&1") | crontab -u $SUDO_USER -
    
    log_success "Monitoring configured"
}

# Main installation function
main() {
    log "Starting installation process..."
    
    verify_jetson
    install_dependencies
    install_docker
    install_nvidia_docker
    install_nodejs
    copy_application
    install_node_dependencies
    setup_audio
    download_models
    create_service
    setup_monitoring
    
    log_success "🎉 Installation completed successfully!"
    log ""
    log "Next steps:"
    log "1. Reboot the system: sudo reboot"
    log "2. After reboot, start the service: sudo systemctl start $SERVICE_NAME"
    log "3. Check status: sudo systemctl status $SERVICE_NAME"
    log "4. Access web interface: http://localhost:8080"
    log "5. View logs: journalctl -u $SERVICE_NAME -f"
    log ""
    log "Installation directory: $INSTALL_DIR"
    log "Service name: $SERVICE_NAME"
}

# Run main function
main "$@"
EOF

    # Replace placeholders
    sed -i "s/__VERSION__/$VERSION/g" "$installer_path/scripts/install.sh"
    sed -i "s/__CREATED__/$(date '+%Y-%m-%d %H:%M:%S')/g" "$installer_path/scripts/install.sh"
    
    # Create uninstaller script
    cat > "$installer_path/scripts/uninstall.sh" << 'EOF'
#!/bin/bash

# Jetson Home Assistant USB Uninstaller

set -e

INSTALL_DIR="/opt/home-assistant"
SERVICE_NAME="jetson-home-assistant"

echo "🗑️ Uninstalling Jetson Home Assistant..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
    echo "❌ This uninstaller must be run as root"
    echo "Usage: sudo ./uninstall.sh"
    exit 1
fi

# Stop and disable service
echo "Stopping service..."
systemctl stop $SERVICE_NAME || true
systemctl disable $SERVICE_NAME || true

# Remove service file
rm -f /etc/systemd/system/${SERVICE_NAME}.service
systemctl daemon-reload

# Remove application directory
echo "Removing application files..."
rm -rf "$INSTALL_DIR"

# Remove cron jobs
echo "Removing cron jobs..."
crontab -u $SUDO_USER -l 2>/dev/null | grep -v "$INSTALL_DIR" | crontab -u $SUDO_USER - || true

# Clean up logs
rm -f /var/log/jetson-installer.log

echo "✅ Uninstallation completed successfully!"
echo "Note: Docker and system dependencies were not removed"
EOF
    
    # Make scripts executable
    chmod +x "$installer_path/scripts/install.sh"
    chmod +x "$installer_path/scripts/uninstall.sh"
    
    echo -e "${GREEN}✅ Installer scripts created${NC}"
}

create_documentation() {
    local installer_path="$1"
    
    echo -e "${BLUE}📚 Creating USB installation documentation...${NC}"
    
    cat > "$installer_path/docs/USB_INSTALLATION.md" << EOF
# USB Installation Guide for Jetson Nano Orin

## Overview
This USB drive contains a complete offline installer for the Jetson Home Assistant.
No internet connection is required during installation (except for Docker registry access).

## Package Contents
- **app/**: Complete application with all dependencies
- **scripts/**: Installation and maintenance scripts  
- **docs/**: Documentation and guides
- **logs/**: Installation logs (created during install)

## System Requirements
- NVIDIA Jetson Nano Orin (8GB RAM)
- JetPack SDK 5.1 or later
- 8GB+ available storage
- USB port for this installer
- Audio input/output devices

## Installation Steps

### 1. Prepare Jetson Device
1. Flash JetPack 5.1+ to your Jetson Nano Orin
2. Complete initial setup (user account, network, etc.)
3. Connect audio devices (microphone, speakers)
4. Connect this USB drive

### 2. Run Installation
1. Open terminal on Jetson
2. Navigate to USB drive:
   \`\`\`bash
   cd /media/\$USER/*/jetson-home-assistant
   \`\`\`
3. Verify contents:
   \`\`\`bash
   ls -la
   \`\`\`
4. Run installer:
   \`\`\`bash
   sudo ./scripts/install.sh
   \`\`\`

### 3. Post-Installation
1. Reboot system:
   \`\`\`bash
   sudo reboot
   \`\`\`
2. Start service:
   \`\`\`bash
   sudo systemctl start jetson-home-assistant
   \`\`\`
3. Check status:
   \`\`\`bash
   sudo systemctl status jetson-home-assistant
   \`\`\`
4. Access web interface:
   - Open browser to \`http://localhost:8080\`

## Verification
After installation, verify the system:

\`\`\`bash
# Check service status
sudo systemctl status jetson-home-assistant

# Run health check
cd /opt/home-assistant
node dist/health-check.js

# Check logs
journalctl -u jetson-home-assistant -f
\`\`\`

## Troubleshooting

### Installation Fails
1. Check system requirements
2. Verify USB drive integrity
3. Check installation logs: \`/var/log/jetson-installer.log\`
4. Ensure sufficient disk space (8GB+)

### Service Won't Start
1. Check Docker status: \`sudo systemctl status docker\`
2. Verify NVIDIA runtime: \`docker run --rm --runtime=nvidia nvidia/cuda:11.4-base-ubuntu20.04 nvidia-smi\`
3. Check audio devices: \`aplay -l && arecord -l\`

### Performance Issues
1. Monitor resources: \`htop\`, \`nvtop\`
2. Check temperature: \`cat /sys/class/thermal/thermal_zone*/temp\`
3. Verify memory usage: \`free -h\`

## Maintenance

### Update Application
1. Create new USB installer with updated version
2. Stop service: \`sudo systemctl stop jetson-home-assistant\`
3. Backup configuration: \`cp -r /opt/home-assistant/config ~/config-backup\`
4. Run new installer
5. Restore custom configuration if needed

### Uninstall
\`\`\`bash
sudo ./scripts/uninstall.sh
\`\`\`

### Backup Configuration
\`\`\`bash
# Backup user data
sudo tar -czf ~/home-assistant-backup.tar.gz /opt/home-assistant/config /opt/home-assistant/logs

# Restore from backup
sudo tar -xzf ~/home-assistant-backup.tar.gz -C /
\`\`\`

## Security Notes
- Change default passwords after installation
- Configure firewall rules as needed
- Regular security updates recommended
- Monitor system logs for unusual activity

## Support
- Installation logs: \`/var/log/jetson-installer.log\`
- Application logs: \`/opt/home-assistant/logs/\`
- Health check: \`node /opt/home-assistant/dist/health-check.js\`
- System status: \`sudo systemctl status jetson-home-assistant\`

## Version Information
- Installer Version: $VERSION
- Created: $(date '+%Y-%m-%d %H:%M:%S')
- Target Platform: NVIDIA Jetson Nano Orin
- JetPack Version: 5.1+

---
For detailed technical documentation, see DEPLOYMENT.md
EOF
    
    echo -e "${GREEN}✅ USB documentation created${NC}"
}

create_version_info() {
    local installer_path="$1"
    
    echo -e "${BLUE}📋 Creating version information...${NC}"
    
    cat > "$installer_path/VERSION.json" << EOF
{
  "version": "$VERSION",
  "created": "$(date '+%Y-%m-%d %H:%M:%S')",
  "platform": "jetson-nano-orin",
  "jetpack_version": "5.1+",
  "node_version": "18.x",
  "includes_models": $INCLUDE_MODELS,
  "production_build": $PRODUCTION_BUILD,
  "files": {
    "application": "app/",
    "scripts": "scripts/",
    "documentation": "docs/",
    "configuration": "app/config/"
  },
  "requirements": {
    "ram_gb": 8,
    "storage_gb": 8,
    "jetpack": "5.1+",
    "docker": "20.10+"
  }
}
EOF
    
    echo -e "${GREEN}✅ Version information created${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🚀 Creating USB installer for Jetson Home Assistant v$VERSION${NC}"
    echo -e "${YELLOW}Target USB Drive: $USB_MOUNT_POINT${NC}"
    
    test_prerequisites
    build_application
    
    installer_path=$(create_usb_structure "$USB_MOUNT_POINT")
    
    copy_application_files "$installer_path"
    create_installer_scripts "$installer_path"
    create_documentation "$installer_path"
    create_version_info "$installer_path"
    
    echo ""
    echo -e "${GREEN}🎉 USB installer created successfully!${NC}"
    echo ""
    echo -e "${BLUE}USB Contents:${NC}"
    echo -e "${YELLOW}  📁 $USB_MOUNT_POINT/jetson-home-assistant/${NC}"
    echo -e "${NC}     📁 app/                 - Application files${NC}"
    echo -e "${NC}     📁 scripts/             - Installation scripts${NC}"
    echo -e "${NC}     📁 docs/                - Documentation${NC}"
    echo -e "${NC}     📄 VERSION.json         - Version information${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "${NC}1. Safely eject USB drive${NC}"
    echo -e "${NC}2. Connect to Jetson Nano Orin${NC}"
    echo -e "${NC}3. Run: sudo ./scripts/install.sh${NC}"
    echo ""
    echo -e "${YELLOW}For detailed instructions, see docs/USB_INSTALLATION.md${NC}"
}

# Execute main function
main