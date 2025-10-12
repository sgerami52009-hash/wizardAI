#!/bin/bash

# JetPack 5 Specific Deployment Script for Jetson Nano Orin
# Optimized for JetPack 5.1 with CUDA 11.4 and TensorRT 8.5

set -e

# Configuration
JETSON_HOST="${JETSON_HOST:-jetson-nano.local}"
JETSON_USER="${JETSON_USER:-shervin}"
DEPLOY_DIR="/home/$JETSON_USER/home-assistant"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# JetPack 5 Configuration
JETPACK_VERSION=5.1
CUDA_VERSION=11.4
TENSORRT_VERSION=8.5

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check JetPack 5 compatibility
check_jetpack5_compatibility() {
    log "Checking JetPack 5 compatibility..."
    
    # Check if we can reach the Jetson
    if ! ping -c 1 "$JETSON_HOST" &>/dev/null; then
        log_error "Cannot reach Jetson at $JETSON_HOST"
        log "Please ensure the device is powered on and connected to the network"
        exit 1
    fi
    
    # Check SSH access
    if ! ssh -o ConnectTimeout=5 "$JETSON_USER@$JETSON_HOST" "echo 'SSH connection successful'" &>/dev/null; then
        log_error "Cannot SSH to $JETSON_USER@$JETSON_HOST"
        log "Please ensure SSH is enabled and you have the correct credentials"
        exit 1
    fi
    
    # Check JetPack version
    jetpack_info=$(ssh "$JETSON_USER@$JETSON_HOST" "cat /etc/nv_tegra_release 2>/dev/null | head -1 || echo 'Unknown'")
    log "Detected system: $jetpack_info"
    
    # Check if it's JetPack 5.x
    if ssh "$JETSON_USER@$JETSON_HOST" "cat /etc/nv_tegra_release 2>/dev/null | grep -q 'R35'" &>/dev/null; then
        log_success "JetPack 5.x detected - compatible"
    else
        log_warning "JetPack version may not be 5.x - proceeding with caution"
    fi
    
    # Check available memory
    memory_gb=$(ssh "$JETSON_USER@$JETSON_HOST" "free -g | grep Mem | awk '{print \$2}'")
    if [ "$memory_gb" -ge 7 ]; then
        log_success "Memory: ${memory_gb}GB available"
    else
        log_warning "Memory: Only ${memory_gb}GB available (8GB recommended)"
    fi
    
    # Check Docker
    if ! ssh "$JETSON_USER@$JETSON_HOST" "command -v docker" &>/dev/null; then
        log_error "Docker not found on Jetson device"
        log "Installing Docker..."
        install_docker_jetpack5
    else
        docker_version=$(ssh "$JETSON_USER@$JETSON_HOST" "docker --version")
        log_success "Docker found: $docker_version"
    fi
    
    log_success "JetPack 5 compatibility check passed"
}

# Install Docker optimized for JetPack 5
install_docker_jetpack5() {
    log "Installing Docker for JetPack 5..."
    
    ssh "$JETSON_USER@$JETSON_HOST" "
        # Remove old Docker versions
        sudo apt-get remove -y docker docker-engine docker.io containerd runc || true
        
        # Update package index
        sudo apt-get update
        
        # Install prerequisites
        sudo apt-get install -y \
            apt-transport-https \
            ca-certificates \
            curl \
            gnupg \
            lsb-release
        
        # Add Docker GPG key
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
        
        # Add Docker repository
        echo \"deb [arch=arm64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \$(lsb_release -cs) stable\" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        # Install Docker
        sudo apt-get update
        sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
        
        # Add user to docker group
        sudo usermod -aG docker \$USER
        
        # Install NVIDIA Container Runtime for JetPack 5
        distribution=\$(. /etc/os-release;echo \$ID\$VERSION_ID)
        curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
        curl -s -L https://nvidia.github.io/nvidia-docker/\$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
        
        sudo apt-get update
        sudo apt-get install -y nvidia-container-runtime
        
        # Configure Docker daemon for NVIDIA runtime
        sudo mkdir -p /etc/docker
        echo '{
            \"default-runtime\": \"nvidia\",
            \"runtimes\": {
                \"nvidia\": {
                    \"path\": \"nvidia-container-runtime\",
                    \"runtimeArgs\": []
                }
            }
        }' | sudo tee /etc/docker/daemon.json
        
        # Restart Docker
        sudo systemctl restart docker
        sudo systemctl enable docker
    "
    
    log_success "Docker installation completed"
}

# Build application with JetPack 5 optimizations
build_application_jetpack5() {
    log "Building application for JetPack 5..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies with JetPack 5 compatibility
    npm ci
    
    # Set Node.js memory limit for JetPack 5
    export NODE_OPTIONS="--max-old-space-size=4096"
    
    # Build the application
    npm run build
    
    # Verify build
    if [ ! -f "dist/index.js" ]; then
        log_error "Build failed - dist/index.js not found"
        exit 1
    fi
    
    log_success "Application built successfully for JetPack 5"
}

# Create JetPack 5 deployment package
create_jetpack5_package() {
    log "Creating JetPack 5 deployment package..."
    
    cd "$PROJECT_ROOT"
    
    # Create temporary deployment directory
    TEMP_DIR=$(mktemp -d)
    PACKAGE_DIR="$TEMP_DIR/home-assistant"
    
    mkdir -p "$PACKAGE_DIR"
    
    # Copy necessary files
    cp -r dist "$PACKAGE_DIR/"
    cp -r config "$PACKAGE_DIR/"
    cp -r deployment "$PACKAGE_DIR/"
    cp package*.json "$PACKAGE_DIR/"
    cp README.md "$PACKAGE_DIR/"
    
    # Copy JetPack 5 specific files
    cp deployment/Dockerfile.jetson-jetpack5 "$PACKAGE_DIR/deployment/"
    cp deployment/docker-compose.jetpack5.yml "$PACKAGE_DIR/deployment/"
    
    # Install production dependencies
    cd "$PACKAGE_DIR"
    npm ci --production
    
    # Create models directory
    mkdir -p models
    
    # Create archive
    cd "$TEMP_DIR"
    tar -czf home-assistant-jetpack5.tar.gz home-assistant/
    
    # Move to deployment directory
    mv home-assistant-jetpack5.tar.gz "$SCRIPT_DIR/"
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    log_success "JetPack 5 deployment package created"
}

# Transfer files to Jetson
transfer_files_jetpack5() {
    log "Transferring files to Jetson..."
    
    # Create deployment directory on Jetson
    ssh "$JETSON_USER@$JETSON_HOST" "mkdir -p $DEPLOY_DIR"
    
    # Transfer deployment package
    scp "$SCRIPT_DIR/home-assistant-jetpack5.tar.gz" "$JETSON_USER@$JETSON_HOST:$DEPLOY_DIR/"
    
    # Extract on Jetson
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && tar -xzf home-assistant-jetpack5.tar.gz --strip-components=1"
    
    # Set permissions
    ssh "$JETSON_USER@$JETSON_HOST" "chmod +x $DEPLOY_DIR/deployment/*.sh"
    
    log_success "Files transferred successfully"
}

# Deploy with JetPack 5 configuration
deploy_jetpack5() {
    log "Deploying with JetPack 5 configuration..."
    
    # Stop existing containers
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && docker compose -f deployment/docker-compose.jetpack5.yml down || true"
    
    # Build Docker image for JetPack 5
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && docker build -f deployment/Dockerfile.jetson-jetpack5 -t jetson-home-assistant-jp5 ."
    
    # Start new container with JetPack 5 configuration
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && docker compose -f deployment/docker-compose.jetpack5.yml up -d"
    
    log_success "JetPack 5 deployment completed"
}

# Verify JetPack 5 deployment
verify_jetpack5_deployment() {
    log "Verifying JetPack 5 deployment..."
    
    # Wait for container to start (longer timeout for JetPack 5)
    sleep 60
    
    # Check container status
    if ssh "$JETSON_USER@$JETSON_HOST" "docker ps | grep jetson-home-assistant-jp5" &>/dev/null; then
        log_success "Container is running"
    else
        log_error "Container is not running"
        ssh "$JETSON_USER@$JETSON_HOST" "docker logs jetson-home-assistant-jp5"
        exit 1
    fi
    
    # Check health endpoint with retries
    for i in {1..5}; do
        if ssh "$JETSON_USER@$JETSON_HOST" "curl -f http://localhost:3000/health" &>/dev/null; then
            log_success "Health check passed"
            break
        else
            log_warning "Health check attempt $i/5 failed - retrying in 30s..."
            sleep 30
        fi
    done
    
    # Check resource usage
    ssh "$JETSON_USER@$JETSON_HOST" "docker stats jetson-home-assistant-jp5 --no-stream"
    
    # Check NVIDIA GPU access
    if ssh "$JETSON_USER@$JETSON_HOST" "docker exec jetson-home-assistant-jp5 nvidia-smi" &>/dev/null; then
        log_success "NVIDIA GPU access verified"
    else
        log_warning "NVIDIA GPU access may not be working"
    fi
    
    log_success "JetPack 5 deployment verification completed"
}

# Main deployment function
main() {
    log "Starting JetPack 5 deployment to Jetson Nano Orin..."
    log "Target: $JETSON_USER@$JETSON_HOST"
    
    check_jetpack5_compatibility
    build_application_jetpack5
    create_jetpack5_package
    transfer_files_jetpack5
    deploy_jetpack5
    verify_jetpack5_deployment
    
    log_success "JetPack 5 deployment completed successfully!"
    log ""
    log "Access your Home Assistant at:"
    log "  Web Interface: http://$JETSON_HOST:8080"
    log "  API Endpoint: http://$JETSON_HOST:3000"
    log ""
    log "To monitor the deployment:"
    log "  ssh $JETSON_USER@$JETSON_HOST"
    log "  docker logs -f jetson-home-assistant-jp5"
    log ""
    log "To update the deployment:"
    log "  ./deployment/deploy-jetson-jetpack5.sh"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "JetPack 5 Deployment Script for Jetson Nano Orin"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Environment variables:"
        echo "  JETSON_HOST    - Jetson device hostname or IP (default: jetson-nano.local)"
        echo "  JETSON_USER    - SSH username (default: shervin)"
        echo ""
        echo "Examples:"
        echo "  JETSON_HOST=192.168.1.100 $0"
        echo "  JETSON_USER=shervin JETSON_HOST=jetson.local $0"
        echo ""
        echo "This script is optimized for JetPack 5.1 with:"
        echo "  - CUDA 11.4"
        echo "  - TensorRT 8.5"
        echo "  - Ubuntu 20.04"
        echo "  - Node.js 18 LTS"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac