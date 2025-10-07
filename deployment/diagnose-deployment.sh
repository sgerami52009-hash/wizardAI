#!/bin/bash

# Deployment Diagnostic Script
# Run this to identify issues before deploying to Jetson

set -e

# Configuration
JETSON_HOST="${JETSON_HOST:-jetson-nano.local}"
JETSON_USER="${JETSON_USER:-shervin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🔍 Jetson Deployment Diagnostics${NC}"
echo -e "${CYAN}=================================${NC}"

# Test 1: Local Environment
echo -e "\n${YELLOW}1️⃣ Checking Local Environment...${NC}"

# Check Node.js
if command -v node >/dev/null 2>&1; then
    node_version=$(node --version)
    echo -e "${GREEN}✅ Node.js: $node_version${NC}"
else
    echo -e "${RED}❌ Node.js: Not found${NC}"
fi

# Check npm
if command -v npm >/dev/null 2>&1; then
    npm_version=$(npm --version)
    echo -e "${GREEN}✅ npm: $npm_version${NC}"
else
    echo -e "${RED}❌ npm: Not found${NC}"
fi

# Check project structure
if [ -f "package.json" ]; then
    echo -e "${GREEN}✅ package.json: Found${NC}"
else
    echo -e "${RED}❌ package.json: Not found (run from project root)${NC}"
fi

if [ -f "deployment/deploy-jetson.sh" ]; then
    echo -e "${GREEN}✅ deploy-jetson.sh: Found${NC}"
else
    echo -e "${RED}❌ deploy-jetson.sh: Not found${NC}"
fi

# Test 2: Network Connectivity
echo -e "\n${YELLOW}2️⃣ Testing Network Connectivity...${NC}"

echo "Testing connection to: $JETSON_HOST"
if ping -c 2 -W 5 "$JETSON_HOST" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Ping: $JETSON_HOST is reachable${NC}"
else
    echo -e "${RED}❌ Ping: Cannot reach $JETSON_HOST${NC}"
    echo -e "${YELLOW}💡 Try: export JETSON_HOST=192.168.1.XXX${NC}"
fi

# Test 3: SSH Connection
echo -e "\n${YELLOW}3️⃣ Testing SSH Connection...${NC}"

echo "Testing SSH to: $JETSON_USER@$JETSON_HOST"
if timeout 10 ssh -o ConnectTimeout=5 -o BatchMode=yes "$JETSON_USER@$JETSON_HOST" "echo 'SSH OK'" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ SSH: Connection successful${NC}"
    
    # Get system info
    jetson_info=$(ssh "$JETSON_USER@$JETSON_HOST" "cat /etc/nv_tegra_release 2>/dev/null | head -1 || echo 'Not a Jetson device'")
    echo -e "${CYAN}   System: $jetson_info${NC}"
    
    # Check memory
    memory_info=$(ssh "$JETSON_USER@$JETSON_HOST" "free -h | grep Mem | awk '{print \$2}'")
    echo -e "${CYAN}   Memory: $memory_info${NC}"
    
    # Check disk space
    disk_info=$(ssh "$JETSON_USER@$JETSON_HOST" "df -h /home | tail -1 | awk '{print \$4\" available\"}'")
    echo -e "${CYAN}   Disk: $disk_info${NC}"
    
else
    echo -e "${RED}❌ SSH: Connection failed${NC}"
    echo -e "${YELLOW}💡 Try: ssh-copy-id $JETSON_USER@$JETSON_HOST${NC}"
fi

# Test 4: Docker on Jetson
echo -e "\n${YELLOW}4️⃣ Checking Docker on Jetson...${NC}"

if timeout 10 ssh -o ConnectTimeout=5 "$JETSON_USER@$JETSON_HOST" "command -v docker" >/dev/null 2>&1; then
    docker_version=$(ssh "$JETSON_USER@$JETSON_HOST" "docker --version 2>/dev/null || echo 'Version unknown'")
    echo -e "${GREEN}✅ Docker: $docker_version${NC}"
    
    # Check Docker Compose
    if ssh "$JETSON_USER@$JETSON_HOST" "docker compose version" >/dev/null 2>&1; then
        compose_version=$(ssh "$JETSON_USER@$JETSON_HOST" "docker compose version --short 2>/dev/null || echo 'Plugin'")
        echo -e "${GREEN}✅ Docker Compose: $compose_version${NC}"
    elif ssh "$JETSON_USER@$JETSON_HOST" "docker-compose --version" >/dev/null 2>&1; then
        compose_version=$(ssh "$JETSON_USER@$JETSON_HOST" "docker-compose --version 2>/dev/null || echo 'Legacy'")
        echo -e "${GREEN}✅ Docker Compose: $compose_version${NC}"
    else
        echo -e "${RED}❌ Docker Compose: Not found${NC}"
    fi
    
    # Check NVIDIA runtime
    if ssh "$JETSON_USER@$JETSON_HOST" "docker info | grep nvidia" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ NVIDIA Runtime: Available${NC}"
    else
        echo -e "${YELLOW}⚠️ NVIDIA Runtime: Not detected${NC}"
    fi
    
else
    echo -e "${RED}❌ Docker: Not found on Jetson${NC}"
    echo -e "${YELLOW}💡 Install: curl -fsSL https://get.docker.com | sh${NC}"
fi

# Test 5: Build Test
echo -e "\n${YELLOW}5️⃣ Testing Local Build...${NC}"

if [ -f "package.json" ]; then
    # Check TypeScript
    if npx tsc --version >/dev/null 2>&1; then
        tsc_version=$(npx tsc --version)
        echo -e "${GREEN}✅ TypeScript: $tsc_version${NC}"
    else
        echo -e "${YELLOW}⚠️ TypeScript: Not found (will install during build)${NC}"
    fi
    
    # Check if dist exists
    if [ -d "dist" ] && [ -f "dist/index.js" ]; then
        build_size=$(stat -f%z "dist/index.js" 2>/dev/null || stat -c%s "dist/index.js" 2>/dev/null || echo "0")
        echo -e "${GREEN}✅ Build: dist/index.js exists ($build_size bytes)${NC}"
    else
        echo -e "${YELLOW}⚠️ Build: No existing build found${NC}"
    fi
else
    echo -e "${RED}❌ Build: Cannot test (no package.json)${NC}"
fi

# Test 6: Port Availability
echo -e "\n${YELLOW}6️⃣ Checking Port Availability...${NC}"

if timeout 10 ssh -o ConnectTimeout=5 "$JETSON_USER@$JETSON_HOST" "netstat -tuln 2>/dev/null | grep -E ':(3000|8080)'" >/dev/null 2>&1; then
    ports_in_use=$(ssh "$JETSON_USER@$JETSON_HOST" "netstat -tuln 2>/dev/null | grep -E ':(3000|8080)' | awk '{print \$4}' | cut -d: -f2 | sort | uniq | tr '\n' ' '")
    echo -e "${YELLOW}⚠️ Ports in use: $ports_in_use${NC}"
    echo -e "${YELLOW}💡 Stop existing services or containers${NC}"
else
    echo -e "${GREEN}✅ Ports: 3000 and 8080 appear available${NC}"
fi

# Summary
echo -e "\n${BLUE}📋 Diagnostic Summary${NC}"
echo -e "${BLUE}=====================${NC}"

echo -e "${CYAN}Environment Variables:${NC}"
echo -e "  JETSON_HOST=$JETSON_HOST"
echo -e "  JETSON_USER=$JETSON_USER"

echo -e "\n${CYAN}Recommended Next Steps:${NC}"
echo -e "1. Fix any ${RED}❌ issues${NC} shown above"
echo -e "2. Use the fixed deployment script: ${YELLOW}./deployment/deploy-jetson-fixed.sh${NC}"
echo -e "3. For detailed help: ${YELLOW}cat deployment/TROUBLESHOOTING.md${NC}"

echo -e "\n${CYAN}Alternative Deployment Methods:${NC}"
echo -e "• IP-based: ${YELLOW}./deployment/deploy-jetson-ip.sh -i 192.168.1.XXX${NC}"
echo -e "• USB installer: ${YELLOW}./deployment/create-usb-installer.sh -u /media/usb${NC}"
echo -e "• Virtual test: ${YELLOW}node simple-jetson-test.js${NC}"

echo -e "\n${GREEN}🎯 Diagnostics completed!${NC}"