#!/bin/bash
# Shell script to verify deployment readiness
# Run this before deploying to Jetson

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Verifying deployment readiness...${NC}"

errors=()
warnings=()

# Check required files
required_files=(
    "deployment/Dockerfile.jetson"
    "deployment/docker-compose.jetson.yml"
    "deployment/deploy-jetson.sh"
    "deployment/jetson-setup.sh"
    "deployment/download-models.sh"
    "config/production.json"
    "dist/index.js"
    "dist/health-check.js"
    "package.json"
)

echo -e "${YELLOW}📁 Checking required files...${NC}"
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}  ✅ $file${NC}"
    else
        echo -e "${RED}  ❌ $file${NC}"
        errors+=("Missing file: $file")
    fi
done

# Check package.json
if [ -f "package.json" ]; then
    echo -e "${YELLOW}📦 Checking package.json...${NC}"
    
    if command -v jq >/dev/null 2>&1; then
        # Use jq if available
        if jq -e '.scripts.build' package.json >/dev/null 2>&1; then
            echo -e "${GREEN}  ✅ Build script found${NC}"
        else
            warnings+=("No build script in package.json")
        fi
        
        if jq -e '.engines.node' package.json >/dev/null 2>&1; then
            node_version=$(jq -r '.engines.node' package.json)
            echo -e "${GREEN}  ✅ Node.js version specified: $node_version${NC}"
        else
            warnings+=("No Node.js version specified in package.json")
        fi
    else
        # Fallback to grep if jq not available
        if grep -q '"build"' package.json; then
            echo -e "${GREEN}  ✅ Build script found${NC}"
        else
            warnings+=("No build script in package.json")
        fi
        
        if grep -q '"node"' package.json; then
            echo -e "${GREEN}  ✅ Node.js version specified${NC}"
        else
            warnings+=("No Node.js version specified in package.json")
        fi
    fi
fi

# Check if built
if [ -f "dist/index.js" ]; then
    echo -e "${YELLOW}🏗️ Checking build output...${NC}"
    index_size=$(stat -f%z "dist/index.js" 2>/dev/null || stat -c%s "dist/index.js" 2>/dev/null || echo "0")
    if [ "$index_size" -gt 1000 ]; then
        echo -e "${GREEN}  ✅ dist/index.js looks good ($index_size bytes)${NC}"
    else
        warnings+=("dist/index.js seems too small ($index_size bytes)")
    fi
fi

# Check configuration
if [ -f "config/production.json" ]; then
    echo -e "${YELLOW}⚙️ Checking production config...${NC}"
    
    if command -v jq >/dev/null 2>&1; then
        if jq -e '.jetson' config/production.json >/dev/null 2>&1; then
            echo -e "${GREEN}  ✅ Jetson configuration found${NC}"
        else
            warnings+=("No Jetson-specific configuration found")
        fi
        
        if jq -e '.safety.child_safety_enabled' config/production.json >/dev/null 2>&1; then
            echo -e "${GREEN}  ✅ Child safety enabled${NC}"
        else
            warnings+=("Child safety not explicitly enabled")
        fi
    else
        # Fallback to grep
        if grep -q '"jetson"' config/production.json; then
            echo -e "${GREEN}  ✅ Jetson configuration found${NC}"
        else
            warnings+=("No Jetson-specific configuration found")
        fi
        
        if grep -q '"child_safety_enabled"' config/production.json; then
            echo -e "${GREEN}  ✅ Child safety configuration found${NC}"
        else
            warnings+=("Child safety not explicitly configured")
        fi
    fi
fi

# Check Docker files
if [ -f "deployment/Dockerfile.jetson" ]; then
    echo -e "${YELLOW}🐳 Checking Docker configuration...${NC}"
    if grep -q "nvcr.io/nvidia/l4t-base" deployment/Dockerfile.jetson; then
        echo -e "${GREEN}  ✅ Using NVIDIA L4T base image${NC}"
    else
        warnings+=("Not using NVIDIA L4T base image")
    fi
fi

# Summary
echo -e "\n${BLUE}📊 Verification Summary:${NC}"
echo -e "${BLUE}=======================${NC}"

if [ ${#errors[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ No critical errors found!${NC}"
else
    echo -e "${RED}❌ Critical errors found:${NC}"
    for error in "${errors[@]}"; do
        echo -e "${RED}  • $error${NC}"
    done
fi

if [ ${#warnings[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ No warnings!${NC}"
else
    echo -e "${YELLOW}⚠️ Warnings:${NC}"
    for warning in "${warnings[@]}"; do
        echo -e "${YELLOW}  • $warning${NC}"
    done
fi

# Next steps
if [ ${#errors[@]} -eq 0 ]; then
    echo -e "\n${GREEN}🚀 Ready for deployment!${NC}"
    echo -e "${BLUE}Next steps:${NC}"
    echo -e "${NC}1. Set environment variables:${NC}"
    echo -e "${GRAY}   export JETSON_HOST='jetson-nano.local'${NC}"
    echo -e "${GRAY}   export JETSON_USER='jetson'${NC}"
    echo -e "${NC}2. Run deployment:${NC}"
    echo -e "${GRAY}   cd deployment${NC}"
    echo -e "${GRAY}   ./deploy-jetson.sh${NC}"
else
    echo -e "\n${RED}❌ Please fix the errors before deploying${NC}"
    exit 1
fi

echo -e "\n${CYAN}📚 For detailed instructions, see deployment/README.md${NC}"