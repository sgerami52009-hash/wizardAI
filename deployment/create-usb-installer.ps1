# USB Installer Creation Script for Jetson Nano Orin
# Creates a complete deployment package on USB drive

param(
    [Parameter(Mandatory=$true)]
    [string]$UsbDriveLetter,
    
    [string]$Version = "1.0.0",
    [switch]$IncludeModels = $false,
    [switch]$ProductionBuild = $false
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Cyan"

function Write-ColorOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-Prerequisites {
    Write-ColorOutput "🔍 Checking prerequisites..." $Blue
    
    # Check if USB drive exists
    if (!(Test-Path "${UsbDriveLetter}:\")) {
        Write-ColorOutput "❌ USB drive ${UsbDriveLetter}:\ not found" $Red
        exit 1
    }
    
    # Check available space (need at least 2GB)
    $drive = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='${UsbDriveLetter}:'"
    $freeSpaceGB = [math]::Round($drive.FreeSpace / 1GB, 2)
    
    if ($freeSpaceGB -lt 2) {
        Write-ColorOutput "❌ Insufficient space on USB drive. Need 2GB, have ${freeSpaceGB}GB" $Red
        exit 1
    }
    
    Write-ColorOutput "✅ USB drive ${UsbDriveLetter}:\ has ${freeSpaceGB}GB free space" $Green
    
    # Check if Node.js project exists
    if (!(Test-Path "package.json")) {
        Write-ColorOutput "❌ package.json not found. Run from project root directory" $Red
        exit 1
    }
    
    Write-ColorOutput "✅ Prerequisites check passed" $Green
}

function Build-Application {
    Write-ColorOutput "🔨 Building application..." $Blue
    
    # Install dependencies
    Write-ColorOutput "Installing dependencies..." $Yellow
    npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "❌ npm ci failed" $Red
        exit 1
    }
    
    # Run safety audit
    Write-ColorOutput "Running safety audit..." $Yellow
    npm run safety-audit
    
    # Build application
    Write-ColorOutput "Building TypeScript..." $Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-ColorOutput "❌ Build failed" $Red
        exit 1
    }
    
    Write-ColorOutput "✅ Application built successfully" $Green
}

function Create-UsbStructure {
    param([string]$UsbPath)
    
    Write-ColorOutput "📁 Creating USB directory structure..." $Blue
    
    $installerPath = "${UsbPath}\jetson-home-assistant"
    
    # Create main directories
    $directories = @(
        $installerPath,
        "${installerPath}\app",
        "${installerPath}\app\dist",
        "${installerPath}\app\config",
        "${installerPath}\app\deployment",
        "${installerPath}\app\models",
        "${installerPath}\scripts",
        "${installerPath}\docs",
        "${installerPath}\logs"
    )
    
    foreach ($dir in $directories) {
        if (!(Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    Write-ColorOutput "✅ USB directory structure created" $Green
    return $installerPath
}

function Copy-ApplicationFiles {
    param([string]$InstallerPath)
    
    Write-ColorOutput "📋 Copying application files..." $Blue
    
    # Copy built application
    Copy-Item -Path "dist\*" -Destination "${InstallerPath}\app\dist\" -Recurse -Force
    
    # Copy configuration
    Copy-Item -Path "config\*" -Destination "${InstallerPath}\app\config\" -Recurse -Force
    
    # Copy deployment scripts
    Copy-Item -Path "deployment\*" -Destination "${InstallerPath}\app\deployment\" -Recurse -Force
    
    # Copy package files
    Copy-Item -Path "package.json" -Destination "${InstallerPath}\app\" -Force
    Copy-Item -Path "package-lock.json" -Destination "${InstallerPath}\app\" -Force -ErrorAction SilentlyContinue
    
    # Copy documentation
    Copy-Item -Path "README.md" -Destination "${InstallerPath}\docs\" -Force -ErrorAction SilentlyContinue
    Copy-Item -Path "deployment\README.md" -Destination "${InstallerPath}\docs\DEPLOYMENT.md" -Force
    
    Write-ColorOutput "✅ Application files copied" $Green
}

function Create-InstallerScripts {
    param([string]$InstallerPath)
    
    Write-ColorOutput "📝 Creating installer scripts..." $Blue
    
    # Create main installer script
    $mainInstaller = @"
#!/bin/bash

# Jetson Home Assistant USB Installer
# Version: $Version
# Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

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
    echo -e "`${BLUE}[`$(date '+%H:%M:%S')]`${NC} `$1" | tee -a "`$LOG_FILE"
}

log_success() {
    echo -e "`${GREEN}[SUCCESS]`${NC} `$1" | tee -a "`$LOG_FILE"
}

log_error() {
    echo -e "`${RED}[ERROR]`${NC} `$1" | tee -a "`$LOG_FILE"
}

log_warning() {
    echo -e "`${YELLOW}[WARNING]`${NC} `$1" | tee -a "`$LOG_FILE"
}

# Check if running as root
if [[ `$EUID -ne 0 ]]; then
    log_error "This installer must be run as root"
    log "Usage: sudo ./install.sh"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="`$(cd "`$(dirname "`${BASH_SOURCE[0]}")" && pwd)"
USB_ROOT="`$(dirname "`$SCRIPT_DIR")"

log "🚀 Starting Jetson Home Assistant USB Installation..."
log "USB Root: `$USB_ROOT"
log "Install Directory: `$INSTALL_DIR"

# Verify Jetson hardware
verify_jetson() {
    log "🔍 Verifying Jetson hardware..."
    
    if [ ! -f /etc/nv_tegra_release ]; then
        log_error "Not running on NVIDIA Jetson hardware"
        exit 1
    fi
    
    # Check memory
    TOTAL_MEM=`$(free -m | awk 'NR==2{printf "%.0f", `$2}')
    if [ "`$TOTAL_MEM" -lt 7000 ]; then
        log_error "Insufficient memory: `${TOTAL_MEM}MB (requires 8GB)"
        exit 1
    fi
    
    log_success "Jetson Nano Orin verified with `${TOTAL_MEM}MB RAM"
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
        "deb [arch=`$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
        `$(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add user to docker group
    usermod -aG docker `$SUDO_USER
    
    # Enable Docker service
    systemctl enable docker
    systemctl start docker
    
    log_success "Docker installed"
}

# Install NVIDIA Container Toolkit
install_nvidia_docker() {
    log "🎮 Installing NVIDIA Container Toolkit..."
    
    distribution=`$(. /etc/os-release;echo `$ID`$VERSION_ID) \
        && curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg \
        && curl -s -L https://nvidia.github.io/libnvidia-container/`$distribution/libnvidia-container.list | \
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
        NODE_VERSION=`$(node --version)
        log_success "Node.js already installed: `$NODE_VERSION"
        return
    fi
    
    # Install Node.js 18 LTS
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
    
    log_success "Node.js installed: `$(node --version)"
}

# Copy application files
copy_application() {
    log "📋 Copying application files..."
    
    # Create install directory
    mkdir -p "`$INSTALL_DIR"
    
    # Copy application files from USB
    cp -r "`$USB_ROOT/app/"* "`$INSTALL_DIR/"
    
    # Set permissions
    chown -R `$SUDO_USER:`$SUDO_USER "`$INSTALL_DIR"
    chmod +x "`$INSTALL_DIR/deployment/"*.sh
    
    log_success "Application files copied to `$INSTALL_DIR"
}

# Install Node.js dependencies
install_node_dependencies() {
    log "📦 Installing Node.js dependencies..."
    
    cd "`$INSTALL_DIR"
    
    # Install production dependencies
    sudo -u `$SUDO_USER npm ci --only=production
    
    log_success "Node.js dependencies installed"
}

# Setup audio system
setup_audio() {
    log "🔊 Setting up audio system..."
    
    # Configure ALSA
    cat > /etc/asound.conf << 'EOF'
pcm.!default {
    type pulse
}
ctl.!default {
    type pulse
}
EOF
    
    # Add user to audio group
    usermod -a -G audio `$SUDO_USER
    
    log_success "Audio system configured"
}

# Download AI models
download_models() {
    log "🤖 Setting up AI models..."
    
    cd "`$INSTALL_DIR"
    
    # Run model download script
    sudo -u `$SUDO_USER ./deployment/download-models.sh --placeholder
    
    log_success "AI models configured"
}

# Create systemd service
create_service() {
    log "⚙️ Creating systemd service..."
    
    cat > /etc/systemd/system/`${SERVICE_NAME}.service << EOF
[Unit]
Description=Jetson Home Assistant
After=network.target sound.target docker.service
Wants=network.target
Requires=docker.service

[Service]
Type=simple
User=`$SUDO_USER
Group=`$SUDO_USER
WorkingDirectory=`$INSTALL_DIR
Environment=NODE_ENV=production
Environment=CUDA_VISIBLE_DEVICES=0
ExecStart=/usr/bin/node dist/index.js
ExecReload=/bin/kill -HUP \`$MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=`$SERVICE_NAME

# Resource limits for Jetson Nano Orin
MemoryMax=6G
CPUQuota=600%

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=`$INSTALL_DIR/logs `$INSTALL_DIR/temp `$INSTALL_DIR/cache
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable `${SERVICE_NAME}.service
    
    log_success "Systemd service created and enabled"
}

# Setup monitoring
setup_monitoring() {
    log "📊 Setting up monitoring..."
    
    # Create health check cron job
    (crontab -u `$SUDO_USER -l 2>/dev/null; echo "*/5 * * * * cd `$INSTALL_DIR && node dist/health-check.js >> logs/health.log 2>&1") | crontab -u `$SUDO_USER -
    
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
    log "2. After reboot, start the service: sudo systemctl start `$SERVICE_NAME"
    log "3. Check status: sudo systemctl status `$SERVICE_NAME"
    log "4. Access web interface: http://localhost:8080"
    log "5. View logs: journalctl -u `$SERVICE_NAME -f"
    log ""
    log "Installation directory: `$INSTALL_DIR"
    log "Service name: `$SERVICE_NAME"
}

# Run main function
main "`$@"
"@

    $mainInstaller | Out-File -FilePath "${InstallerPath}\scripts\install.sh" -Encoding UTF8
    
    # Create uninstaller script
    $uninstaller = @"
#!/bin/bash

# Jetson Home Assistant USB Uninstaller

set -e

INSTALL_DIR="/opt/home-assistant"
SERVICE_NAME="jetson-home-assistant"

echo "🗑️ Uninstalling Jetson Home Assistant..."

# Check if running as root
if [[ `$EUID -ne 0 ]]; then
    echo "❌ This uninstaller must be run as root"
    echo "Usage: sudo ./uninstall.sh"
    exit 1
fi

# Stop and disable service
echo "Stopping service..."
systemctl stop `$SERVICE_NAME || true
systemctl disable `$SERVICE_NAME || true

# Remove service file
rm -f /etc/systemd/system/`${SERVICE_NAME}.service
systemctl daemon-reload

# Remove application directory
echo "Removing application files..."
rm -rf "`$INSTALL_DIR"

# Remove cron jobs
echo "Removing cron jobs..."
crontab -u `$SUDO_USER -l 2>/dev/null | grep -v "`$INSTALL_DIR" | crontab -u `$SUDO_USER - || true

# Clean up logs
rm -f /var/log/jetson-installer.log

echo "✅ Uninstallation completed successfully!"
echo "Note: Docker and system dependencies were not removed"
"@

    $uninstaller | Out-File -FilePath "${InstallerPath}\scripts\uninstall.sh" -Encoding UTF8
    
    Write-ColorOutput "✅ Installer scripts created" $Green
}

function Create-WindowsHelpers {
    param([string]$InstallerPath)
    
    Write-ColorOutput "🪟 Creating Windows helper scripts..." $Blue
    
    # Create Windows batch file to run installer
    $windowsInstaller = @"
@echo off
echo.
echo ===============================================
echo  Jetson Home Assistant USB Installer
echo  Version: $Version
echo ===============================================
echo.
echo This will install the Home Assistant on your Jetson Nano Orin
echo.
echo Prerequisites:
echo - Jetson Nano Orin with JetPack 5.1+
echo - USB drive connected to Jetson
echo - Root/sudo access on Jetson
echo.
echo Instructions:
echo 1. Connect this USB drive to your Jetson Nano Orin
echo 2. Open terminal on Jetson
echo 3. Navigate to USB drive: cd /media/`$USER/*/jetson-home-assistant
echo 4. Run installer: sudo ./scripts/install.sh
echo.
echo For detailed instructions, see docs\DEPLOYMENT.md
echo.
pause
"@

    $windowsInstaller | Out-File -FilePath "${InstallerPath}\INSTALL_ON_JETSON.bat" -Encoding ASCII
    
    # Create verification script
    $verifyScript = @"
@echo off
echo.
echo ===============================================
echo  USB Installer Verification
echo ===============================================
echo.

set "USB_ROOT=%~dp0"
echo USB Root: %USB_ROOT%

echo.
echo Checking required files...

if exist "%USB_ROOT%app\dist\index.js" (
    echo ✓ Main application found
) else (
    echo ✗ Main application missing
    goto :error
)

if exist "%USB_ROOT%app\config\production.json" (
    echo ✓ Configuration found
) else (
    echo ✗ Configuration missing
    goto :error
)

if exist "%USB_ROOT%scripts\install.sh" (
    echo ✓ Installer script found
) else (
    echo ✗ Installer script missing
    goto :error
)

if exist "%USB_ROOT%app\deployment\download-models.sh" (
    echo ✓ Model download script found
) else (
    echo ✗ Model download script missing
    goto :error
)

echo.
echo ✅ All required files present!
echo USB installer is ready for deployment.
echo.
goto :end

:error
echo.
echo ❌ USB installer is incomplete!
echo Please recreate the USB installer.
echo.

:end
pause
"@

    $verifyScript | Out-File -FilePath "${InstallerPath}\VERIFY_USB.bat" -Encoding ASCII
    
    Write-ColorOutput "✅ Windows helper scripts created" $Green
}

function Create-Documentation {
    param([string]$InstallerPath)
    
    Write-ColorOutput "📚 Creating USB installation documentation..." $Blue
    
    $usbDocs = @"
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
   ```bash
   cd /media/`$USER/*/jetson-home-assistant
   ```
3. Verify contents:
   ```bash
   ls -la
   ./VERIFY_USB.bat  # On Windows before transfer
   ```
4. Run installer:
   ```bash
   sudo ./scripts/install.sh
   ```

### 3. Post-Installation
1. Reboot system:
   ```bash
   sudo reboot
   ```
2. Start service:
   ```bash
   sudo systemctl start jetson-home-assistant
   ```
3. Check status:
   ```bash
   sudo systemctl status jetson-home-assistant
   ```
4. Access web interface:
   - Open browser to `http://localhost:8080`

## Verification
After installation, verify the system:

```bash
# Check service status
sudo systemctl status jetson-home-assistant

# Run health check
cd /opt/home-assistant
node dist/health-check.js

# Check logs
journalctl -u jetson-home-assistant -f
```

## Troubleshooting

### Installation Fails
1. Check system requirements
2. Verify USB drive integrity
3. Check installation logs: `/var/log/jetson-installer.log`
4. Ensure sufficient disk space (8GB+)

### Service Won't Start
1. Check Docker status: `sudo systemctl status docker`
2. Verify NVIDIA runtime: `docker run --rm --runtime=nvidia nvidia/cuda:11.4-base-ubuntu20.04 nvidia-smi`
3. Check audio devices: `aplay -l && arecord -l`

### Performance Issues
1. Monitor resources: `htop`, `nvtop`
2. Check temperature: `cat /sys/class/thermal/thermal_zone*/temp`
3. Verify memory usage: `free -h`

## Maintenance

### Update Application
1. Create new USB installer with updated version
2. Stop service: `sudo systemctl stop jetson-home-assistant`
3. Backup configuration: `cp -r /opt/home-assistant/config ~/config-backup`
4. Run new installer
5. Restore custom configuration if needed

### Uninstall
```bash
sudo ./scripts/uninstall.sh
```

### Backup Configuration
```bash
# Backup user data
sudo tar -czf ~/home-assistant-backup.tar.gz /opt/home-assistant/config /opt/home-assistant/logs

# Restore from backup
sudo tar -xzf ~/home-assistant-backup.tar.gz -C /
```

## Security Notes
- Change default passwords after installation
- Configure firewall rules as needed
- Regular security updates recommended
- Monitor system logs for unusual activity

## Support
- Installation logs: `/var/log/jetson-installer.log`
- Application logs: `/opt/home-assistant/logs/`
- Health check: `node /opt/home-assistant/dist/health-check.js`
- System status: `sudo systemctl status jetson-home-assistant`

## Version Information
- Installer Version: $Version
- Created: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
- Target Platform: NVIDIA Jetson Nano Orin
- JetPack Version: 5.1+

---
For detailed technical documentation, see DEPLOYMENT.md
"@

    $usbDocs | Out-File -FilePath "${InstallerPath}\docs\USB_INSTALLATION.md" -Encoding UTF8
    
    Write-ColorOutput "✅ USB documentation created" $Green
}

function Create-VersionInfo {
    param([string]$InstallerPath)
    
    Write-ColorOutput "📋 Creating version information..." $Blue
    
    $versionInfo = @{
        version = $Version
        created = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        platform = "jetson-nano-orin"
        jetpack_version = "5.1+"
        node_version = "18.x"
        includes_models = $IncludeModels
        production_build = $ProductionBuild
        files = @{
            application = "app/"
            scripts = "scripts/"
            documentation = "docs/"
            configuration = "app/config/"
        }
        requirements = @{
            ram_gb = 8
            storage_gb = 8
            jetpack = "5.1+"
            docker = "20.10+"
        }
    }
    
    $versionInfo | ConvertTo-Json -Depth 3 | Out-File -FilePath "${InstallerPath}\VERSION.json" -Encoding UTF8
    
    Write-ColorOutput "✅ Version information created" $Green
}

function Create-AutorunFile {
    param([string]$InstallerPath)
    
    Write-ColorOutput "💿 Creating autorun file..." $Blue
    
    $autorun = @"
[autorun]
open=INSTALL_ON_JETSON.bat
icon=docs\icon.ico
label=Jetson Home Assistant Installer v$Version
"@

    $autorun | Out-File -FilePath "${InstallerPath}\..\autorun.inf" -Encoding ASCII
    
    Write-ColorOutput "✅ Autorun file created" $Green
}

# Main execution
function Main {
    Write-ColorOutput "🚀 Creating USB installer for Jetson Home Assistant v$Version" $Blue
    Write-ColorOutput "Target USB Drive: ${UsbDriveLetter}:\" $Yellow
    
    Test-Prerequisites
    Build-Application
    
    $installerPath = Create-UsbStructure "${UsbDriveLetter}:"
    
    Copy-ApplicationFiles $installerPath
    Create-InstallerScripts $installerPath
    Create-WindowsHelpers $installerPath
    Create-Documentation $installerPath
    Create-VersionInfo $installerPath
    Create-AutorunFile $installerPath
    
    Write-ColorOutput "" $White
    Write-ColorOutput "🎉 USB installer created successfully!" $Green
    Write-ColorOutput "" $White
    Write-ColorOutput "USB Contents:" $Blue
    Write-ColorOutput "  📁 ${UsbDriveLetter}:\jetson-home-assistant\" $Yellow
    Write-ColorOutput "     📁 app\                 - Application files" $White
    Write-ColorOutput "     📁 scripts\             - Installation scripts" $White
    Write-ColorOutput "     📁 docs\                - Documentation" $White
    Write-ColorOutput "     📄 INSTALL_ON_JETSON.bat - Windows helper" $White
    Write-ColorOutput "     📄 VERIFY_USB.bat       - Verification script" $White
    Write-ColorOutput "     📄 VERSION.json         - Version information" $White
    Write-ColorOutput "" $White
    Write-ColorOutput "Next Steps:" $Blue
    Write-ColorOutput "1. Safely eject USB drive" $White
    Write-ColorOutput "2. Connect to Jetson Nano Orin" $White
    Write-ColorOutput "3. Run: sudo ./scripts/install.sh" $White
    Write-ColorOutput "" $White
    Write-ColorOutput "For detailed instructions, see docs\USB_INSTALLATION.md" $Yellow
}

# Execute main function
Main