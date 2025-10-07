#!/bin/bash
# Shell deployment script for Jetson using IP address

set -e

# Default values
JETSON_USER="shervin"
PROJECT_NAME="jetson-home-assistant"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Parse command line arguments
usage() {
    echo "Usage: $0 -i JETSON_IP [-u JETSON_USER] [-p PROJECT_NAME]"
    echo "  -i JETSON_IP    IP address of the Jetson device (required)"
    echo "  -u JETSON_USER  Username for SSH connection (default: shervin)"
    echo "  -p PROJECT_NAME Project name (default: jetson-home-assistant)"
    exit 1
}

while getopts "i:u:p:h" opt; do
    case $opt in
        i) JETSON_IP="$OPTARG" ;;
        u) JETSON_USER="$OPTARG" ;;
        p) PROJECT_NAME="$OPTARG" ;;
        h) usage ;;
        *) usage ;;
    esac
done

if [ -z "$JETSON_IP" ]; then
    echo -e "${RED}❌ Jetson IP address is required${NC}"
    usage
fi

echo -e "${CYAN}🚀 Deploying to Jetson Nano Orin${NC}"
echo -e "${YELLOW}Target: $JETSON_USER@$JETSON_IP${NC}"
echo -e "${YELLOW}Project: $PROJECT_NAME${NC}"

# Test connection first
echo -e "${CYAN}🔍 Testing connection to Jetson...${NC}"
if ! ping -c 2 -W 5 "$JETSON_IP" >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot reach Jetson at $JETSON_IP${NC}"
    echo -e "${YELLOW}Please check:${NC}"
    echo -e "${NC}1. Jetson is powered on${NC}"
    echo -e "${NC}2. Network connection is working${NC}"
    echo -e "${NC}3. IP address is correct${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Jetson is reachable${NC}"

# Test SSH connection
echo -e "${CYAN}🔐 Testing SSH connection...${NC}"
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$JETSON_USER@$JETSON_IP" "echo 'SSH OK'" >/dev/null 2>&1; then
    echo -e "${RED}❌ SSH connection failed${NC}"
    echo -e "${YELLOW}Please ensure:${NC}"
    echo -e "${NC}1. SSH is enabled on Jetson${NC}"
    echo -e "${NC}2. You have SSH keys set up or password access${NC}"
    echo -e "${NC}3. Username '$JETSON_USER' is correct${NC}"
    echo ""
    echo -e "${CYAN}To enable SSH on Jetson:${NC}"
    echo -e "${GRAY}sudo systemctl enable ssh${NC}"
    echo -e "${GRAY}sudo systemctl start ssh${NC}"
    exit 1
fi
echo -e "${GREEN}✅ SSH connection successful${NC}"

# Check if project files exist
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ package.json not found. Run from project root directory.${NC}"
    exit 1
fi

if [ ! -f "dist/index.js" ]; then
    echo -e "${YELLOW}📦 Building project first...${NC}"
    if ! npm run build; then
        echo -e "${RED}❌ Build failed${NC}"
        exit 1
    fi
fi

# Create deployment package
echo -e "${CYAN}📦 Creating deployment package...${NC}"
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="$TEMP_DIR/$PROJECT_NAME"

mkdir -p "$PACKAGE_DIR"

# Copy necessary files
echo -e "${YELLOW}📋 Copying files...${NC}"
cp -r dist "$PACKAGE_DIR/"
[ -d config ] && cp -r config "$PACKAGE_DIR/"
cp -r deployment "$PACKAGE_DIR/"
cp package*.json "$PACKAGE_DIR/"

# Create archive
ARCHIVE_PATH="/tmp/$PROJECT_NAME-$(date +%Y%m%d-%H%M%S).tar.gz"
echo -e "${YELLOW}📦 Creating archive: $ARCHIVE_PATH${NC}"

tar -czf "$ARCHIVE_PATH" -C "$TEMP_DIR" "$PROJECT_NAME"
echo -e "${GREEN}✅ Archive created${NC}"

# Transfer to Jetson
echo -e "${CYAN}📤 Transferring files to Jetson...${NC}"
REMOTE_DIR="/home/$JETSON_USER/$PROJECT_NAME"

# Create remote directory
ssh "$JETSON_USER@$JETSON_IP" "mkdir -p $REMOTE_DIR"

# Transfer archive
scp "$ARCHIVE_PATH" "$JETSON_USER@$JETSON_IP:$REMOTE_DIR/"

# Extract on Jetson
ARCHIVE_FILE=$(basename "$ARCHIVE_PATH")
ssh "$JETSON_USER@$JETSON_IP" "cd $REMOTE_DIR && tar -xzf $ARCHIVE_FILE --strip-components=1"

# Set permissions
ssh "$JETSON_USER@$JETSON_IP" "chmod +x $REMOTE_DIR/deployment/*.sh"

echo -e "${GREEN}✅ Files transferred successfully${NC}"

# Run setup on Jetson
echo -e "${CYAN}🔧 Running setup on Jetson...${NC}"
if ssh "$JETSON_USER@$JETSON_IP" "cd $REMOTE_DIR && sudo ./deployment/jetson-setup.sh"; then
    echo -e "${GREEN}✅ Jetson setup completed${NC}"
else
    echo -e "${YELLOW}⚠️ Setup may have encountered issues. Check manually.${NC}"
fi

# Download models
echo -e "${CYAN}🤖 Setting up AI models...${NC}"
if ssh "$JETSON_USER@$JETSON_IP" "cd $REMOTE_DIR && ./deployment/download-models.sh --placeholder"; then
    echo -e "${GREEN}✅ Models configured${NC}"
else
    echo -e "${YELLOW}⚠️ Model setup may have encountered issues.${NC}"
fi

# Deploy with Docker
echo -e "${CYAN}🐳 Deploying with Docker...${NC}"
if ssh "$JETSON_USER@$JETSON_IP" "cd $REMOTE_DIR && docker-compose -f deployment/docker-compose.jetson.yml up -d"; then
    echo -e "${GREEN}✅ Docker deployment completed${NC}"
else
    echo -e "${YELLOW}⚠️ Docker deployment may have encountered issues.${NC}"
fi

# Verify deployment
echo -e "${CYAN}🔍 Verifying deployment...${NC}"
sleep 10

if ssh "$JETSON_USER@$JETSON_IP" "curl -f http://localhost:3000/health" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${YELLOW}⚠️ Health check failed - service may still be starting${NC}"
fi

# Cleanup
rm -rf "$TEMP_DIR"
rm -f "$ARCHIVE_PATH"

echo -e "\n🎉 ${GREEN}Deployment completed!${NC}"
echo -e "${BLUE}Access your Home Assistant at:${NC}"
echo -e "${CYAN}  Web Interface: http://$JETSON_IP:8080${NC}"
echo -e "${CYAN}  API Endpoint: http://$JETSON_IP:3000${NC}"
echo ""
echo -e "${BLUE}To monitor:${NC}"
echo -e "${GRAY}  ssh $JETSON_USER@$JETSON_IP${NC}"
echo -e "${GRAY}  docker logs -f jetson-home-assistant${NC}"