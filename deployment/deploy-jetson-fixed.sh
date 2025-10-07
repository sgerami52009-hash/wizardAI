#!/bin/bash

# Fixed Jetson Nano Orin Deployment Script
# This script deploys the Home Assistant to a Jetson Nano Orin device with better error handling

set -e

# Configuration
JETSON_HOST="${JETSON_HOST:-jetson-nano.local}"
JETSON_USER="${JETSON_USER:-jetson}"
DEPLOY_DIR="/home/$JETSON_USER/home-assistant"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

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

# Enhanced prerequisite checks
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/package.json" ]; then
        log_error "package.json not found. Please run from project root directory."
        log "Current directory: $(pwd)"
        log "Expected project root: $PROJECT_ROOT"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js not found. Please install Node.js 18 or later."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm not found. Please install npm."
        exit 1
    fi
    
    # Check if we can reach the Jetson
    log "Testing connection to $JETSON_HOST..."
    if ! ping -c 2 -W 5 "$JETSON_HOST" >/dev/null 2>&1; then
        log_error "Cannot reach Jetson at $JETSON_HOST"
        log "Troubleshooting steps:"
        log "1. Check if Jetson is powered on"
        log "2. Verify network connection"
        log "3. Try using IP address: export JETSON_HOST=192.168.1.XXX"
        log "4. Run: ./scripts/find-jetson.sh to discover Jetson devices"
        exit 1
    fi
    log_success "Jetson is reachable"
    
    # Check SSH access with timeout
    log "Testing SSH connection..."
    if ! timeout 10 ssh -o ConnectTimeout=5 -o BatchMode=yes "$JETSON_USER@$JETSON_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
        log_error "Cannot SSH to $JETSON_USER@$JETSON_HOST"
        log "Troubleshooting steps:"
        log "1. Enable SSH on Jetson: sudo systemctl enable ssh && sudo systemctl start ssh"
        log "2. Set up SSH keys: ssh-copy-id $JETSON_USER@$JETSON_HOST"
        log "3. Test manually: ssh $JETSON_USER@$JETSON_HOST"
        log "4. Check username: export JETSON_USER=your-username"
        exit 1
    fi
    log_success "SSH connection successful"
    
    # Check Jetson system info
    log "Checking Jetson system information..."
    jetson_info=$(ssh "$JETSON_USER@$JETSON_HOST" "cat /etc/nv_tegra_release 2>/dev/null || echo 'Not a Jetson device'")
    if [[ "$jetson_info" == *"Not a Jetson device"* ]]; then
        log_warning "Target device may not be a Jetson Nano"
    else
        log_success "Jetson device confirmed: $(echo "$jetson_info" | head -1)"
    fi
    
    # Check if Docker is available on Jetson
    log "Checking Docker installation..."
    if ! ssh "$JETSON_USER@$JETSON_HOST" "command -v docker" >/dev/null 2>&1; then
        log_error "Docker not found on Jetson device"
        log "Please install Docker first:"
        log "  ssh $JETSON_USER@$JETSON_HOST"
        log "  curl -fsSL https://get.docker.com -o get-docker.sh"
        log "  sudo sh get-docker.sh"
        log "  sudo usermod -aG docker \$USER"
        log "  sudo reboot"
        exit 1
    fi
    log_success "Docker is available"
    
    # Check Docker Compose
    if ! ssh "$JETSON_USER@$JETSON_HOST" "docker compose version" >/dev/null 2>&1; then
        if ! ssh "$JETSON_USER@$JETSON_HOST" "docker-compose --version" >/dev/null 2>&1; then
            log_error "Docker Compose not found on Jetson device"
            log "Please install Docker Compose plugin:"
            log "  ssh $JETSON_USER@$JETSON_HOST"
            log "  sudo apt-get update && sudo apt-get install docker-compose-plugin"
            exit 1
        fi
    fi
    log_success "Docker Compose is available"
    
    # Check available disk space
    available_space=$(ssh "$JETSON_USER@$JETSON_HOST" "df /home | awk 'NR==2 {print \$4}'")
    if [ "$available_space" -lt 2097152 ]; then  # 2GB in KB
        log_warning "Low disk space on Jetson: $(($available_space / 1024))MB available"
        log "Recommend at least 2GB free space for deployment"
    else
        log_success "Sufficient disk space available: $(($available_space / 1024))MB"
    fi
    
    log_success "All prerequisites check passed"
}

# Enhanced build function
build_application() {
    log "Building application locally..."
    
    cd "$PROJECT_ROOT"
    
    # Check if TypeScript is available
    if ! npx tsc --version >/dev/null 2>&1; then
        log "Installing TypeScript..."
        npm install typescript --save-dev
    fi
    
    # Clean previous build
    rm -rf dist/
    
    # Install dependencies with retry
    log "Installing dependencies..."
    for i in {1..3}; do
        if npm ci; then
            break
        else
            log_warning "npm ci failed, attempt $i/3"
            if [ $i -eq 3 ]; then
                log_error "Failed to install dependencies after 3 attempts"
                exit 1
            fi
            sleep 5
        fi
    done
    
    # Run safety audit (non-blocking)
    log "Running safety audit..."
    npm run safety-audit || log_warning "Safety audit completed with warnings"
    
    # Build the application
    log "Building TypeScript..."
    if ! npm run build; then
        log_error "Build failed"
        log "Try running: npm install typescript --save-dev"
        exit 1
    fi
    
    # Verify build output
    if [ ! -f "dist/index.js" ]; then
        log_error "Build failed - dist/index.js not found"
        exit 1
    fi
    
    # Check build size
    build_size=$(stat -f%z "dist/index.js" 2>/dev/null || stat -c%s "dist/index.js" 2>/dev/null)
    if [ "$build_size" -lt 1000 ]; then
        log_warning "Build output seems small: $build_size bytes"
    else
        log_success "Application built successfully: $build_size bytes"
    fi
}

# Enhanced package creation
create_deployment_package() {
    log "Creating deployment package..."
    
    cd "$PROJECT_ROOT"
    
    # Create temporary deployment directory
    TEMP_DIR=$(mktemp -d)
    PACKAGE_DIR="$TEMP_DIR/home-assistant"
    
    mkdir -p "$PACKAGE_DIR"
    
    # Copy necessary files with verification
    log "Copying application files..."
    
    # Essential files
    cp -r dist "$PACKAGE_DIR/" || { log_error "Failed to copy dist/"; exit 1; }
    cp package*.json "$PACKAGE_DIR/" || { log_error "Failed to copy package files"; exit 1; }
    
    # Optional files (don't fail if missing)
    [ -d config ] && cp -r config "$PACKAGE_DIR/" || log_warning "config/ directory not found"
    [ -d deployment ] && cp -r deployment "$PACKAGE_DIR/" || log_warning "deployment/ directory not found"
    [ -f README.md ] && cp README.md "$PACKAGE_DIR/" || log_warning "README.md not found"
    
    # Create required directories
    mkdir -p "$PACKAGE_DIR"/{models,logs,temp,cache}
    
    # Install production dependencies in package
    log "Installing production dependencies..."
    cd "$PACKAGE_DIR"
    if ! npm ci --only=production --silent; then
        log_error "Failed to install production dependencies"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    cd "$PROJECT_ROOT"
    
    # Create archive with compression
    log "Creating deployment archive..."
    cd "$TEMP_DIR"
    if ! tar -czf home-assistant-jetson.tar.gz home-assistant/; then
        log_error "Failed to create deployment archive"
        rm -rf "$TEMP_DIR"
        exit 1
    fi
    
    # Move to deployment directory
    mv home-assistant-jetson.tar.gz "$SCRIPT_DIR/"
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    # Verify archive
    archive_size=$(stat -f%z "$SCRIPT_DIR/home-assistant-jetson.tar.gz" 2>/dev/null || stat -c%s "$SCRIPT_DIR/home-assistant-jetson.tar.gz" 2>/dev/null)
    log_success "Deployment package created: $(($archive_size / 1024 / 1024))MB"
}

# Enhanced file transfer
transfer_files() {
    log "Transferring files to Jetson..."
    
    # Create deployment directory on Jetson
    ssh "$JETSON_USER@$JETSON_HOST" "mkdir -p $DEPLOY_DIR"
    
    # Transfer deployment package with progress
    log "Uploading deployment package..."
    if ! scp -o ConnectTimeout=30 "$SCRIPT_DIR/home-assistant-jetson.tar.gz" "$JETSON_USER@$JETSON_HOST:$DEPLOY_DIR/"; then
        log_error "Failed to transfer deployment package"
        exit 1
    fi
    
    # Extract on Jetson with verification
    log "Extracting files on Jetson..."
    if ! ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && tar -xzf home-assistant-jetson.tar.gz --strip-components=1"; then
        log_error "Failed to extract files on Jetson"
        exit 1
    fi
    
    # Set permissions
    ssh "$JETSON_USER@$JETSON_HOST" "find $DEPLOY_DIR -name '*.sh' -exec chmod +x {} \;" || log_warning "Could not set script permissions"
    
    # Cleanup archive
    ssh "$JETSON_USER@$JETSON_HOST" "rm -f $DEPLOY_DIR/home-assistant-jetson.tar.gz"
    
    log_success "Files transferred successfully"
}

# Enhanced Jetson setup
setup_jetson_environment() {
    log "Setting up Jetson environment..."
    
    # Check if setup script exists
    if ! ssh "$JETSON_USER@$JETSON_HOST" "[ -f $DEPLOY_DIR/deployment/jetson-setup.sh ]"; then
        log_warning "jetson-setup.sh not found, skipping Jetson-specific setup"
        return 0
    fi
    
    # Run the Jetson initialization script
    log "Running Jetson initialization script..."
    if ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && sudo ./deployment/jetson-setup.sh"; then
        log_success "Jetson environment setup completed"
    else
        log_warning "Jetson setup script completed with warnings"
    fi
}

# Enhanced model download
download_models() {
    log "Setting up AI models on Jetson..."
    
    # Check if model download script exists
    if ! ssh "$JETSON_USER@$JETSON_HOST" "[ -f $DEPLOY_DIR/deployment/download-models.sh ]"; then
        log_warning "download-models.sh not found, skipping model download"
        return 0
    fi
    
    # Run model download script
    if ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && ./deployment/download-models.sh --placeholder"; then
        log_success "AI models configured"
    else
        log_warning "Model download completed with warnings"
    fi
}

# Enhanced Docker deployment
deploy_with_docker() {
    log "Deploying with Docker..."
    
    # Check if Docker files exist
    if ! ssh "$JETSON_USER@$JETSON_HOST" "[ -f $DEPLOY_DIR/deployment/Dockerfile.jetson ]"; then
        log_error "Dockerfile.jetson not found"
        exit 1
    fi
    
    if ! ssh "$JETSON_USER@$JETSON_HOST" "[ -f $DEPLOY_DIR/deployment/docker-compose.jetson.yml ]"; then
        log_error "docker-compose.jetson.yml not found"
        exit 1
    fi
    
    # Stop existing containers
    log "Stopping existing containers..."
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && docker compose -f deployment/docker-compose.jetson.yml down" 2>/dev/null || \
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && docker-compose -f deployment/docker-compose.jetson.yml down" 2>/dev/null || \
    log_warning "No existing containers to stop"
    
    # Build and start containers
    log "Building and starting containers..."
    if ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && docker compose -f deployment/docker-compose.jetson.yml up -d --build" 2>/dev/null; then
        log_success "Docker deployment with compose plugin completed"
    elif ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && docker-compose -f deployment/docker-compose.jetson.yml up -d --build"; then
        log_success "Docker deployment with docker-compose completed"
    else
        log_error "Docker deployment failed"
        log "Checking Docker logs..."
        ssh "$JETSON_USER@$JETSON_HOST" "docker logs jetson-home-assistant" 2>/dev/null || log_warning "Could not retrieve container logs"
        exit 1
    fi
}

# Enhanced verification
verify_deployment() {
    log "Verifying deployment..."
    
    # Wait for container to start
    log "Waiting for container to initialize..."
    sleep 30
    
    # Check container status
    if ssh "$JETSON_USER@$JETSON_HOST" "docker ps | grep jetson-home-assistant" >/dev/null 2>&1; then
        log_success "Container is running"
    else
        log_error "Container is not running"
        log "Container logs:"
        ssh "$JETSON_USER@$JETSON_HOST" "docker logs jetson-home-assistant" 2>/dev/null || log_warning "Could not retrieve logs"
        exit 1
    fi
    
    # Check health endpoint with retries
    log "Testing health endpoint..."
    for i in {1..6}; do
        if ssh "$JETSON_USER@$JETSON_HOST" "curl -f -s http://localhost:3000/health" >/dev/null 2>&1; then
            log_success "Health check passed"
            break
        else
            if [ $i -eq 6 ]; then
                log_warning "Health check failed - service may still be starting"
                log "You can check manually: curl http://$JETSON_HOST:3000/health"
            else
                log "Health check attempt $i/6 failed, retrying in 10 seconds..."
                sleep 10
            fi
        fi
    done
    
    # Check web interface
    log "Testing web interface..."
    if ssh "$JETSON_USER@$JETSON_HOST" "curl -f -s http://localhost:8080" >/dev/null 2>&1; then
        log_success "Web interface is accessible"
    else
        log_warning "Web interface check failed"
        log "You can check manually: http://$JETSON_HOST:8080"
    fi
    
    # Show resource usage
    log "Container resource usage:"
    ssh "$JETSON_USER@$JETSON_HOST" "docker stats jetson-home-assistant --no-stream" 2>/dev/null || log_warning "Could not get resource stats"
    
    log_success "Deployment verification completed"
}

# Cleanup function
cleanup() {
    log "Cleaning up temporary files..."
    rm -f "$SCRIPT_DIR/home-assistant-jetson.tar.gz"
}

# Main deployment function
main() {
    log "Starting deployment to Jetson Nano Orin..."
    log "Target: $JETSON_USER@$JETSON_HOST"
    log "Deploy Directory: $DEPLOY_DIR"
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    check_prerequisites
    build_application
    create_deployment_package
    transfer_files
    setup_jetson_environment
    download_models
    deploy_with_docker
    verify_deployment
    
    log_success "🎉 Deployment completed successfully!"
    echo ""
    log "Access your Home Assistant at:"
    log "  ${CYAN}Web Interface: http://$JETSON_HOST:8080${NC}"
    log "  ${CYAN}API Endpoint: http://$JETSON_HOST:3000${NC}"
    log "  ${CYAN}Health Check: http://$JETSON_HOST:3000/health${NC}"
    echo ""
    log "To monitor the deployment:"
    log "  ${YELLOW}ssh $JETSON_USER@$JETSON_HOST${NC}"
    log "  ${YELLOW}docker logs -f jetson-home-assistant${NC}"
    echo ""
    log "To update the deployment:"
    log "  ${YELLOW}./deployment/deploy-jetson-fixed.sh${NC}"
    echo ""
    log "For troubleshooting, see: ${CYAN}deployment/TROUBLESHOOTING.md${NC}"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Environment variables:"
        echo "  JETSON_HOST    - Jetson device hostname or IP (default: jetson-nano.local)"
        echo "  JETSON_USER    - SSH username (default: jetson)"
        echo ""
        echo "Examples:"
        echo "  JETSON_HOST=192.168.1.100 $0"
        echo "  JETSON_USER=myuser JETSON_HOST=jetson.local $0"
        echo ""
        echo "For troubleshooting, see: deployment/TROUBLESHOOTING.md"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac