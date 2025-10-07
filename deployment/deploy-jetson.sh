#!/bin/bash

# Jetson Nano Orin Deployment Script
# This script deploys the Home Assistant to a Jetson Nano Orin device

set -e

# Configuration
JETSON_HOST="${JETSON_HOST:-jetson-nano.local}"
JETSON_USER="${JETSON_USER:-shervin}"
DEPLOY_DIR="/home/$JETSON_USER/home-assistant"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Check prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
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
    
    # Check if Docker is available on Jetson
    if ! ssh "$JETSON_USER@$JETSON_HOST" "command -v docker" &>/dev/null; then
        log_error "Docker not found on Jetson device"
        log "Please install Docker on the Jetson Nano Orin first"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Build the application locally
build_application() {
    log "Building application locally..."
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies
    npm ci
    
    # Run safety audit
    npm run safety-audit
    
    # Build the application
    npm run build
    
    # Verify build
    if [ ! -f "dist/index.js" ]; then
        log_error "Build failed - dist/index.js not found"
        exit 1
    fi
    
    log_success "Application built successfully"
}

# Create deployment package
create_deployment_package() {
    log "Creating deployment package..."
    
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
    
    # Copy production node_modules (only production dependencies)
    mkdir -p "$PACKAGE_DIR/node_modules"
    npm ci --production --prefix "$PACKAGE_DIR"
    
    # Create models directory (models will be downloaded on Jetson)
    mkdir -p "$PACKAGE_DIR/models"
    
    # Create archive
    cd "$TEMP_DIR"
    tar -czf home-assistant-jetson.tar.gz home-assistant/
    
    # Move to deployment directory
    mv home-assistant-jetson.tar.gz "$SCRIPT_DIR/"
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    log_success "Deployment package created: $SCRIPT_DIR/home-assistant-jetson.tar.gz"
}

# Transfer files to Jetson
transfer_files() {
    log "Transferring files to Jetson..."
    
    # Create deployment directory on Jetson
    ssh "$JETSON_USER@$JETSON_HOST" "mkdir -p $DEPLOY_DIR"
    
    # Transfer deployment package
    scp "$SCRIPT_DIR/home-assistant-jetson.tar.gz" "$JETSON_USER@$JETSON_HOST:$DEPLOY_DIR/"
    
    # Extract on Jetson
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && tar -xzf home-assistant-jetson.tar.gz --strip-components=1"
    
    # Set permissions
    ssh "$JETSON_USER@$JETSON_HOST" "chmod +x $DEPLOY_DIR/deployment/*.sh"
    
    log_success "Files transferred successfully"
}

# Setup Jetson environment
setup_jetson_environment() {
    log "Setting up Jetson environment..."
    
    # Run the Jetson initialization script
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && sudo ./deployment/jetson-setup.sh"
    
    log_success "Jetson environment setup completed"
}

# Download AI models
download_models() {
    log "Downloading AI models on Jetson..."
    
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && ./deployment/download-models.sh"
    
    log_success "AI models downloaded"
}

# Deploy with Docker
deploy_with_docker() {
    log "Deploying with Docker..."
    
    # Build Docker image on Jetson
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && docker build -f deployment/Dockerfile.jetson -t jetson-home-assistant ."
    
    # Stop existing container if running
    ssh "$JETSON_USER@$JETSON_HOST" "docker stop jetson-home-assistant || true"
    ssh "$JETSON_USER@$JETSON_HOST" "docker rm jetson-home-assistant || true"
    
    # Start new container
    ssh "$JETSON_USER@$JETSON_HOST" "cd $DEPLOY_DIR && docker-compose -f deployment/docker-compose.jetson.yml up -d"
    
    log_success "Docker deployment completed"
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Wait for container to start
    sleep 30
    
    # Check container status
    if ssh "$JETSON_USER@$JETSON_HOST" "docker ps | grep jetson-home-assistant" &>/dev/null; then
        log_success "Container is running"
    else
        log_error "Container is not running"
        ssh "$JETSON_USER@$JETSON_HOST" "docker logs jetson-home-assistant"
        exit 1
    fi
    
    # Check health endpoint
    if ssh "$JETSON_USER@$JETSON_HOST" "curl -f http://localhost:3000/health" &>/dev/null; then
        log_success "Health check passed"
    else
        log_warning "Health check failed - service may still be starting"
    fi
    
    # Check resource usage
    ssh "$JETSON_USER@$JETSON_HOST" "docker stats jetson-home-assistant --no-stream"
    
    log_success "Deployment verification completed"
}

# Main deployment function
main() {
    log "Starting deployment to Jetson Nano Orin..."
    log "Target: $JETSON_USER@$JETSON_HOST"
    
    check_prerequisites
    build_application
    create_deployment_package
    transfer_files
    setup_jetson_environment
    download_models
    deploy_with_docker
    verify_deployment
    
    log_success "Deployment completed successfully!"
    log ""
    log "Access your Home Assistant at:"
    log "  Web Interface: http://$JETSON_HOST:8080"
    log "  API Endpoint: http://$JETSON_HOST:3000"
    log ""
    log "To monitor the deployment:"
    log "  ssh $JETSON_USER@$JETSON_HOST"
    log "  docker logs -f jetson-home-assistant"
    log ""
    log "To update the deployment:"
    log "  ./deployment/deploy-jetson.sh"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [options]"
        echo ""
        echo "Environment variables:"
        echo "  JETSON_HOST    - Jetson device hostname or IP (default: jetson-nano.local)"
        echo "  JETSON_USER    - SSH username (default: shervin)"
        echo ""
        echo "Examples:"
        echo "  JETSON_HOST=192.168.1.100 $0"
        echo "  JETSON_USER=shervin JETSON_HOST=jetson.local $0"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac