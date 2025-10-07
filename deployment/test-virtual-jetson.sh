#!/bin/bash
# Virtual Jetson Testing Script
# This script sets up and tests the Home Assistant in a virtual Jetson environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Default flags
BUILD=false
DEPLOY=false
TEST=false
MONITOR=false
CLEANUP=false
ALL=false

# Parse command line arguments
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  -b, --build     Build the application"
    echo "  -d, --deploy    Deploy to virtual Jetson"
    echo "  -t, --test      Test the deployment"
    echo "  -m, --monitor   Monitor the virtual Jetson"
    echo "  -c, --cleanup   Cleanup virtual environment"
    echo "  -a, --all       Run all operations (build, deploy, test, monitor)"
    echo "  -h, --help      Show this help message"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--build) BUILD=true; shift ;;
        -d|--deploy) DEPLOY=true; shift ;;
        -t|--test) TEST=true; shift ;;
        -m|--monitor) MONITOR=true; shift ;;
        -c|--cleanup) CLEANUP=true; shift ;;
        -a|--all) ALL=true; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

if [ "$ALL" = true ]; then
    BUILD=true
    DEPLOY=true
    TEST=true
    MONITOR=true
fi

echo -e "${CYAN}🚀 Virtual Jetson Nano Testing Environment${NC}"
echo -e "${CYAN}===========================================${NC}"

# Build the application
if [ "$BUILD" = true ]; then
    echo -e "${YELLOW}🔨 Building application...${NC}"
    
    # Install dependencies
    npm ci
    
    # Run tests
    echo -e "${GRAY}Running tests...${NC}"
    npm test
    
    # Build application
    echo -e "${GRAY}Building TypeScript...${NC}"
    npm run build
    
    # Verify build
    if [ ! -f "dist/index.js" ]; then
        echo -e "${RED}❌ Build failed - dist/index.js not found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Application built successfully${NC}"
fi

# Deploy to virtual Jetson
if [ "$DEPLOY" = true ]; then
    echo -e "${YELLOW}🐳 Deploying to virtual Jetson environment...${NC}"
    
    # Stop existing containers
    echo -e "${GRAY}Stopping existing containers...${NC}"
    docker-compose -f deployment/docker-compose.virtual-jetson.yml down 2>/dev/null || true
    
    # Build and start virtual Jetson
    echo -e "${GRAY}Building virtual Jetson container...${NC}"
    docker-compose -f deployment/docker-compose.virtual-jetson.yml build
    
    echo -e "${GRAY}Starting virtual Jetson environment...${NC}"
    docker-compose -f deployment/docker-compose.virtual-jetson.yml up -d
    
    # Wait for services to start
    echo -e "${GRAY}Waiting for services to start...${NC}"
    sleep 30
    
    # Check container status
    echo -e "${GRAY}Container status:${NC}"
    docker-compose -f deployment/docker-compose.virtual-jetson.yml ps
    
    echo -e "${GREEN}✅ Virtual Jetson environment deployed${NC}"
fi

# Test the deployment
if [ "$TEST" = true ]; then
    echo -e "${YELLOW}🧪 Testing virtual Jetson deployment...${NC}"
    
    # Test API endpoint
    echo -e "${GRAY}Testing API endpoint...${NC}"
    if curl -s -f "http://localhost:3000/health" >/dev/null 2>&1; then
        health_status=$(curl -s "http://localhost:3000/health" | jq -r '.status' 2>/dev/null || echo "unknown")
        echo -e "${GREEN}✅ API Health Check: $health_status${NC}"
    else
        echo -e "${RED}❌ API Health Check failed${NC}"
    fi
    
    # Test web interface
    echo -e "${GRAY}Testing web interface...${NC}"
    if curl -s -f "http://localhost:8080" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Web Interface: Accessible${NC}"
    else
        echo -e "${RED}❌ Web Interface failed${NC}"
    fi
    
    # Test SSH access to virtual Jetson
    echo -e "${GRAY}Testing SSH access...${NC}"
    if ssh -o ConnectTimeout=5 -o BatchMode=yes jetson@localhost -p 22 "echo 'SSH OK'" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ SSH Access: Working${NC}"
    else
        echo -e "${YELLOW}⚠️ SSH Access: Not configured (use password 'jetson')${NC}"
    fi
    
    # Test container health
    echo -e "${GRAY}Testing container health...${NC}"
    container_health=$(docker inspect virtual-jetson-nano --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
    if [ "$container_health" = "healthy" ]; then
        echo -e "${GREEN}✅ Container Health: Healthy${NC}"
    else
        echo -e "${YELLOW}⚠️ Container Health: $container_health${NC}"
    fi
    
    # Test Jetson-specific features
    echo -e "${GRAY}Testing Jetson simulation features...${NC}"
    if jetson_info=$(docker exec virtual-jetson-nano cat /etc/nv_tegra_release 2>/dev/null); then
        echo -e "${GREEN}✅ Jetson Simulation: Active${NC}"
    else
        echo -e "${YELLOW}⚠️ Jetson Simulation: Limited${NC}"
    fi
    
    echo -e "${GREEN}✅ Testing completed${NC}"
fi

# Monitor the virtual Jetson
if [ "$MONITOR" = true ]; then
    echo -e "${YELLOW}📊 Monitoring virtual Jetson...${NC}"
    
    # Show container stats
    echo -e "${GRAY}Container Resource Usage:${NC}"
    docker stats virtual-jetson-nano --no-stream
    
    # Show application logs
    echo -e "\n${GRAY}Application Logs (last 20 lines):${NC}"
    docker logs virtual-jetson-nano --tail 20
    
    # Show health status
    echo -e "\n${GRAY}Health Status:${NC}"
    if health=$(curl -s "http://localhost:3000/health" 2>/dev/null); then
        echo "$health" | jq . 2>/dev/null || echo "$health"
    else
        echo -e "${RED}Health check not available${NC}"
    fi
    
    # Show system status from inside container
    echo -e "\n${GRAY}Virtual Jetson System Status:${NC}"
    docker exec virtual-jetson-nano /app/jetson-health.sh 2>/dev/null || echo "Health script not available"
fi

# Cleanup
if [ "$CLEANUP" = true ]; then
    echo -e "${YELLOW}🧹 Cleaning up virtual Jetson environment...${NC}"
    
    # Stop and remove containers
    docker-compose -f deployment/docker-compose.virtual-jetson.yml down -v
    
    # Remove images
    docker rmi $(docker images -q "*virtual-jetson*") 2>/dev/null || true
    
    echo -e "${GREEN}✅ Cleanup completed${NC}"
fi

# Display access information
if [ "$DEPLOY" = true ] || [ "$ALL" = true ]; then
    echo -e "\n🌐 ${BLUE}Access Information:${NC}"
    echo -e "${BLUE}=====================${NC}"
    echo -e "${CYAN}Web Interface: http://localhost:8080${NC}"
    echo -e "${CYAN}API Endpoint:  http://localhost:3000${NC}"
    echo -e "${CYAN}Health Check:  http://localhost:3000/health${NC}"
    echo -e "${CYAN}SSH Access:    ssh jetson@localhost (password: jetson)${NC}"
    echo -e "${CYAN}Monitoring:    http://localhost:9090 (Prometheus)${NC}"
    
    echo -e "\n📋 ${BLUE}Useful Commands:${NC}"
    echo -e "${GRAY}View logs:     docker logs -f virtual-jetson-nano${NC}"
    echo -e "${GRAY}Enter shell:   docker exec -it virtual-jetson-nano bash${NC}"
    echo -e "${GRAY}Health check:  docker exec virtual-jetson-nano /app/jetson-health.sh${NC}"
    echo -e "${GRAY}Stop:          docker-compose -f deployment/docker-compose.virtual-jetson.yml down${NC}"
fi

echo -e "\n🎉 ${GREEN}Virtual Jetson testing environment ready!${NC}"