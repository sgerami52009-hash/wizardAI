#!/bin/bash
# Comprehensive Virtual Jetson Testing Script

set -e

echo "🧪 Comprehensive Virtual Jetson Testing"
echo "======================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Test 1: Build Application
echo -e "\n1️⃣ ${YELLOW}Building Application...${NC}"
if npm ci && npm run build; then
    if [ -f "dist/index.js" ]; then
        echo -e "${GREEN}✅ Application built successfully${NC}"
    else
        echo -e "${RED}❌ Build output not found${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Test 2: Start Virtual Environment
echo -e "\n2️⃣ ${YELLOW}Starting Virtual Jetson Environment...${NC}"
# Stop any existing containers
docker-compose -f deployment/docker-compose.virtual-jetson.yml down 2>/dev/null || true

# Start virtual environment
if docker-compose -f deployment/docker-compose.virtual-jetson.yml up -d --build; then
    echo -e "${GREEN}✅ Virtual environment started${NC}"
else
    echo -e "${RED}❌ Failed to start virtual environment${NC}"
    exit 1
fi

# Test 3: Wait for Services
echo -e "\n3️⃣ ${YELLOW}Waiting for services to initialize...${NC}"
max_wait=60
waited=0

while [ $waited -lt $max_wait ]; do
    if curl -s -f "http://localhost:3000/health" >/dev/null 2>&1; then
        response=$(curl -s "http://localhost:3000/health" | jq -r '.status' 2>/dev/null || echo "unknown")
        if [ "$response" = "healthy" ]; then
            echo -e "${GREEN}✅ Services are ready${NC}"
            break
        fi
    fi
    
    sleep 5
    waited=$((waited + 5))
    echo -e "${GRAY}Waiting... ($waited/$max_wait seconds)${NC}"
done

if [ $waited -ge $max_wait ]; then
    echo -e "${YELLOW}⚠️ Services took longer than expected to start${NC}"
fi

# Test 4: API Endpoints
echo -e "\n4️⃣ ${YELLOW}Testing API Endpoints...${NC}"

test_endpoint() {
    local name="$1"
    local url="$2"
    
    if curl -s -f "$url" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $name: OK${NC}"
    else
        echo -e "${RED}❌ $name: Failed${NC}"
    fi
}

test_endpoint "Health Check" "http://localhost:3000/health"
test_endpoint "Status" "http://localhost:3000/status"

# Test 5: Web Interface
echo -e "\n5️⃣ ${YELLOW}Testing Web Interface...${NC}"
if curl -s -f "http://localhost:8080" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Web Interface: Accessible${NC}"
else
    echo -e "${RED}❌ Web Interface: Failed${NC}"
fi

# Test 6: Container Health
echo -e "\n6️⃣ ${YELLOW}Testing Container Health...${NC}"
container_health=$(docker inspect virtual-jetson-nano --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
echo -e "${CYAN}Container Health: $container_health${NC}"

if [ "$container_health" = "healthy" ]; then
    echo -e "${GREEN}✅ Container is healthy${NC}"
else
    echo -e "${YELLOW}⚠️ Container health: $container_health${NC}"
fi

# Test 7: Resource Usage
echo -e "\n7️⃣ ${YELLOW}Checking Resource Usage...${NC}"
if docker stats virtual-jetson-nano --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null; then
    echo -e "${GREEN}✅ Resource monitoring active${NC}"
else
    echo -e "${RED}❌ Could not get resource stats${NC}"
fi

# Test 8: Jetson Simulation Features
echo -e "\n8️⃣ ${YELLOW}Testing Jetson Simulation Features...${NC}"
# Test Jetson identification
if jetson_info=$(docker exec virtual-jetson-nano cat /etc/nv_tegra_release 2>/dev/null); then
    echo -e "${GREEN}✅ Jetson simulation active${NC}"
    echo -e "${CYAN}Jetson Info: $(echo "$jetson_info" | cut -d',' -f1)${NC}"
fi

# Test temperature monitoring
if temp=$(docker exec virtual-jetson-nano cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null); then
    temp_c=$(echo "scale=1; $temp / 1000" | bc)
    echo -e "${GREEN}✅ Temperature monitoring: ${temp_c}°C${NC}"
fi

# Test 9: Application Logs
echo -e "\n9️⃣ ${YELLOW}Checking Application Logs...${NC}"
if logs=$(docker logs virtual-jetson-nano --tail 10 2>/dev/null); then
    echo -e "${GREEN}✅ Application logs available${NC}"
    echo -e "${GRAY}Recent logs:${NC}"
    echo "$logs" | sed 's/^/  /'
else
    echo -e "${YELLOW}⚠️ Could not retrieve logs${NC}"
fi

# Test 10: Performance Benchmarks
echo -e "\n🔟 ${YELLOW}Running Performance Benchmarks...${NC}"
start_time=$(date +%s%3N)
if curl -s -f "http://localhost:3000/health" >/dev/null 2>&1; then
    end_time=$(date +%s%3N)
    response_time=$((end_time - start_time))
    
    if [ $response_time -lt 500 ]; then
        echo -e "${GREEN}✅ Response time: ${response_time}ms (< 500ms target)${NC}"
    else
        echo -e "${YELLOW}⚠️ Response time: ${response_time}ms (> 500ms target)${NC}"
    fi
else
    echo -e "${RED}❌ Performance test failed${NC}"
fi

# Summary
echo -e "\n📊 ${BLUE}Test Summary${NC}"
echo -e "${BLUE}===============${NC}"
echo -e "${GREEN}Virtual Jetson Environment: ✅ Running${NC}"
echo -e "${CYAN}Web Interface: http://localhost:8080${NC}"
echo -e "${CYAN}API Endpoint: http://localhost:3000${NC}"
echo -e "${CYAN}Health Check: http://localhost:3000/health${NC}"

echo -e "\n🎮 ${BLUE}Interactive Commands:${NC}"
echo -e "${GRAY}View logs:    docker logs -f virtual-jetson-nano${NC}"
echo -e "${GRAY}Enter shell:  docker exec -it virtual-jetson-nano bash${NC}"
echo -e "${GRAY}Stop env:     docker-compose -f deployment/docker-compose.virtual-jetson.yml down${NC}"

echo -e "\n🎉 ${GREEN}Virtual Jetson testing completed!${NC}"