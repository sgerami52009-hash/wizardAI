#!/bin/bash

# Docker and JetPack 6 Compatibility Validation Script
# Validates Docker version and JetPack 6 compatibility

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_NAME="Docker JetPack 6 Compatibility Validator"
MIN_DOCKER_VERSION="20.10.0"
RECOMMENDED_DOCKER_VERSION="24.0.0"
MIN_COMPOSE_VERSION="2.0.0"
RECOMMENDED_COMPOSE_VERSION="2.20.0"

echo -e "${BLUE}🐳 $SCRIPT_NAME${NC}"
echo -e "${BLUE}===========================================${NC}"
echo "Validating Docker compatibility with JetPack 6.0+"
echo ""

# Function to compare versions
version_compare() {
    if [[ $1 == $2 ]]; then
        return 0
    fi
    local IFS=.
    local i ver1=($1) ver2=($2)
    # fill empty fields in ver1 with zeros
    for ((i=${#ver1[@]}; i<${#ver2[@]}; i++)); do
        ver1[i]=0
    done
    for ((i=0; i<${#ver1[@]}; i++)); do
        if [[ -z ${ver2[i]} ]]; then
            # fill empty fields in ver2 with zeros
            ver2[i]=0
        fi
        if ((10#${ver1[i]} > 10#${ver2[i]})); then
            return 1
        fi
        if ((10#${ver1[i]} < 10#${ver2[i]})); then
            return 2
        fi
    done
    return 0
}

# Check if running on Jetson
check_jetson_platform() {
    echo -e "${YELLOW}🔍 Checking Jetson platform...${NC}"
    
    if [ -f /etc/nv_tegra_release ]; then
        TEGRA_INFO=$(cat /etc/nv_tegra_release | head -1)
        echo -e "  ${GREEN}✅ Jetson platform detected: $TEGRA_INFO${NC}"
        
        # Check for JetPack 6 indicators
        if echo "$TEGRA_INFO" | grep -q "R36"; then
            echo -e "  ${GREEN}✅ JetPack 6.x detected (R36.x)${NC}"
            JETPACK_6=true
        elif echo "$TEGRA_INFO" | grep -q "R35"; then
            echo -e "  ${YELLOW}⚠️  JetPack 5.x detected (R35.x) - Consider upgrading to JetPack 6${NC}"
            JETPACK_6=false
        else
            echo -e "  ${YELLOW}⚠️  Unknown JetPack version${NC}"
            JETPACK_6=false
        fi
    else
        echo -e "  ${YELLOW}⚠️  Not running on Jetson platform (or tegra release info not available)${NC}"
        JETPACK_6=false
    fi
    echo ""
}

# Check Docker installation
check_docker() {
    echo -e "${YELLOW}🐳 Checking Docker installation...${NC}"
    
    if command -v docker >/dev/null 2>&1; then
        DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        echo -e "  ${GREEN}✅ Docker installed: $DOCKER_VERSION${NC}"
        
        # Check minimum version
        version_compare $DOCKER_VERSION $MIN_DOCKER_VERSION
        case $? in
            0|1)
                echo -e "  ${GREEN}✅ Docker version meets minimum requirement ($MIN_DOCKER_VERSION)${NC}"
                ;;
            2)
                echo -e "  ${RED}❌ Docker version too old. Minimum required: $MIN_DOCKER_VERSION${NC}"
                echo -e "  ${YELLOW}   Please upgrade Docker for JetPack 6 compatibility${NC}"
                return 1
                ;;
        esac
        
        # Check recommended version
        version_compare $DOCKER_VERSION $RECOMMENDED_DOCKER_VERSION
        case $? in
            0|1)
                echo -e "  ${GREEN}✅ Docker version meets recommended requirement ($RECOMMENDED_DOCKER_VERSION)${NC}"
                ;;
            2)
                echo -e "  ${YELLOW}⚠️  Docker version below recommended ($RECOMMENDED_DOCKER_VERSION)${NC}"
                echo -e "  ${YELLOW}   Consider upgrading for optimal JetPack 6 performance${NC}"
                ;;
        esac
        
    else
        echo -e "  ${RED}❌ Docker not installed${NC}"
        echo -e "  ${YELLOW}   Install Docker with: curl -fsSL https://get.docker.com | sh${NC}"
        return 1
    fi
    echo ""
}

# Check Docker Compose
check_docker_compose() {
    echo -e "${YELLOW}📦 Checking Docker Compose...${NC}"
    
    # Check for Docker Compose V2 (preferred)
    if docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || docker compose version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        echo -e "  ${GREEN}✅ Docker Compose V2 installed: $COMPOSE_VERSION${NC}"
        COMPOSE_V2=true
    # Check for Docker Compose V1 (legacy)
    elif command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
        echo -e "  ${YELLOW}⚠️  Docker Compose V1 installed: $COMPOSE_VERSION${NC}"
        echo -e "  ${YELLOW}   Consider upgrading to Docker Compose V2 for better JetPack 6 support${NC}"
        COMPOSE_V2=false
    else
        echo -e "  ${RED}❌ Docker Compose not installed${NC}"
        echo -e "  ${YELLOW}   Install with: sudo apt-get install docker-compose-plugin${NC}"
        return 1
    fi
    
    # Check version compatibility
    version_compare $COMPOSE_VERSION $MIN_COMPOSE_VERSION
    case $? in
        0|1)
            echo -e "  ${GREEN}✅ Docker Compose version meets minimum requirement ($MIN_COMPOSE_VERSION)${NC}"
            ;;
        2)
            echo -e "  ${RED}❌ Docker Compose version too old. Minimum required: $MIN_COMPOSE_VERSION${NC}"
            return 1
            ;;
    esac
    echo ""
}

# Check NVIDIA Container Runtime
check_nvidia_runtime() {
    echo -e "${YELLOW}🎮 Checking NVIDIA Container Runtime...${NC}"
    
    if docker info 2>/dev/null | grep -q "nvidia"; then
        echo -e "  ${GREEN}✅ NVIDIA Container Runtime detected${NC}"
    else
        echo -e "  ${YELLOW}⚠️  NVIDIA Container Runtime not detected${NC}"
        echo -e "  ${YELLOW}   This is required for GPU acceleration in JetPack 6${NC}"
        
        if [ "$JETPACK_6" = true ]; then
            echo -e "  ${YELLOW}   Install with: sudo apt-get install nvidia-container-runtime${NC}"
        fi
    fi
    echo ""
}

# Check system resources
check_system_resources() {
    echo -e "${YELLOW}💾 Checking system resources...${NC}"
    
    # Memory check
    TOTAL_MEM=$(free -g | awk '/^Mem:/{print $2}')
    if [ "$TOTAL_MEM" -ge 7 ]; then
        echo -e "  ${GREEN}✅ Memory: ${TOTAL_MEM}GB (sufficient for JetPack 6)${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Memory: ${TOTAL_MEM}GB (may be limited for full JetPack 6 features)${NC}"
    fi
    
    # Disk space check
    AVAILABLE_SPACE=$(df -BG / | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -ge 10 ]; then
        echo -e "  ${GREEN}✅ Disk space: ${AVAILABLE_SPACE}GB available${NC}"
    else
        echo -e "  ${YELLOW}⚠️  Disk space: ${AVAILABLE_SPACE}GB available (may need cleanup)${NC}"
    fi
    
    # CPU cores
    CPU_CORES=$(nproc)
    echo -e "  ${GREEN}✅ CPU cores: $CPU_CORES${NC}"
    echo ""
}

# Check JetPack 6 specific requirements
check_jetpack6_requirements() {
    echo -e "${YELLOW}🚀 Checking JetPack 6 specific requirements...${NC}"
    
    # Check CUDA version
    if command -v nvcc >/dev/null 2>&1; then
        CUDA_VERSION=$(nvcc --version | grep "release" | grep -oE '[0-9]+\.[0-9]+')
        echo -e "  ${GREEN}✅ CUDA available: $CUDA_VERSION${NC}"
        
        # Check if CUDA 12.x (JetPack 6 requirement)
        if [[ $CUDA_VERSION == 12.* ]]; then
            echo -e "  ${GREEN}✅ CUDA 12.x detected (JetPack 6 compatible)${NC}"
        else
            echo -e "  ${YELLOW}⚠️  CUDA $CUDA_VERSION detected (JetPack 6 prefers CUDA 12.x)${NC}"
        fi
    else
        echo -e "  ${YELLOW}⚠️  CUDA not found in PATH${NC}"
    fi
    
    # Check TensorRT
    if [ -f /usr/include/NvInfer.h ]; then
        echo -e "  ${GREEN}✅ TensorRT headers available${NC}"
    else
        echo -e "  ${YELLOW}⚠️  TensorRT headers not found${NC}"
    fi
    
    # Check for Ubuntu 22.04 (JetPack 6 base)
    if [ -f /etc/os-release ]; then
        UBUNTU_VERSION=$(grep VERSION_ID /etc/os-release | cut -d'"' -f2)
        if [[ $UBUNTU_VERSION == "22.04" ]]; then
            echo -e "  ${GREEN}✅ Ubuntu 22.04 detected (JetPack 6 base)${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Ubuntu $UBUNTU_VERSION detected (JetPack 6 uses Ubuntu 22.04)${NC}"
        fi
    fi
    echo ""
}

# Test Docker functionality
test_docker_functionality() {
    echo -e "${YELLOW}🧪 Testing Docker functionality...${NC}"
    
    # Test basic Docker run
    if docker run --rm hello-world >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅ Docker basic functionality working${NC}"
    else
        echo -e "  ${RED}❌ Docker basic functionality failed${NC}"
        return 1
    fi
    
    # Test Docker Compose (if available)
    if [ "$COMPOSE_V2" = true ]; then
        if docker compose version >/dev/null 2>&1; then
            echo -e "  ${GREEN}✅ Docker Compose V2 functionality working${NC}"
        else
            echo -e "  ${RED}❌ Docker Compose V2 functionality failed${NC}"
        fi
    fi
    
    # Test NVIDIA runtime (if available)
    if docker info 2>/dev/null | grep -q "nvidia"; then
        if docker run --rm --runtime=nvidia nvidia/cuda:12.2-base-ubuntu22.04 nvidia-smi >/dev/null 2>&1; then
            echo -e "  ${GREEN}✅ NVIDIA Container Runtime working${NC}"
        else
            echo -e "  ${YELLOW}⚠️  NVIDIA Container Runtime test failed${NC}"
        fi
    fi
    echo ""
}

# Generate compatibility report
generate_report() {
    echo -e "${BLUE}📋 JetPack 6 Docker Compatibility Report${NC}"
    echo -e "${BLUE}=======================================${NC}"
    
    if [ "$JETPACK_6" = true ]; then
        echo -e "${GREEN}✅ Platform: JetPack 6.x compatible${NC}"
    else
        echo -e "${YELLOW}⚠️  Platform: Not JetPack 6 or compatibility unknown${NC}"
    fi
    
    echo -e "Docker Version: $DOCKER_VERSION"
    echo -e "Docker Compose: $COMPOSE_VERSION"
    
    if [ "$JETPACK_6" = true ] && version_compare $DOCKER_VERSION $RECOMMENDED_DOCKER_VERSION; then
        echo -e "${GREEN}✅ Recommended configuration for JetPack 6 deployment${NC}"
        echo ""
        echo -e "${GREEN}🚀 Ready to deploy with:${NC}"
        echo -e "   docker compose -f deployment/docker-compose.jetpack6.yml up -d"
    else
        echo -e "${YELLOW}⚠️  Some optimizations recommended for JetPack 6${NC}"
        echo ""
        echo -e "${YELLOW}📝 Recommendations:${NC}"
        if ! version_compare $DOCKER_VERSION $RECOMMENDED_DOCKER_VERSION; then
            echo -e "   • Upgrade Docker to $RECOMMENDED_DOCKER_VERSION or later"
        fi
        if [ "$JETPACK_6" != true ]; then
            echo -e "   • Upgrade to JetPack 6.0 for optimal performance"
        fi
    fi
}

# Main execution
main() {
    check_jetson_platform
    check_docker || exit 1
    check_docker_compose || exit 1
    check_nvidia_runtime
    check_system_resources
    check_jetpack6_requirements
    test_docker_functionality
    
    echo ""
    generate_report
    
    echo ""
    echo -e "${GREEN}✅ Docker JetPack 6 compatibility validation complete${NC}"
}

# Run main function
main "$@"