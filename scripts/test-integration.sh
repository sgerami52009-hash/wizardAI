#!/bin/bash
# Avatar System Integration Test Runner
# Script to run integration tests with proper setup on Linux/Unix

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Default values
CLEANUP=true
VERBOSE=true

# Parse command line arguments
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Options:"
    echo "  --no-cleanup    Don't cleanup test data after tests"
    echo "  --no-verbose    Run tests without verbose output"
    echo "  -h, --help      Show this help message"
    exit 1
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --no-cleanup) CLEANUP=false; shift ;;
        --no-verbose) VERBOSE=false; shift ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

echo -e "${GREEN}🚀 Avatar System Integration Tests${NC}"
echo -e "${GREEN}==================================${NC}"

# Set environment variables
export NODE_ENV="test"
export AVATAR_TEST_MODE="true"
export AVATAR_LOG_LEVEL="warn"
export AVATAR_DISABLE_HARDWARE_CHECKS="true"

# Create test directories
echo -e "${BLUE}📁 Creating test directories...${NC}"
mkdir -p test-data/integration
mkdir -p test-reports/integration
mkdir -p coverage/integration

# Check if Node.js is available
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js.${NC}"
    exit 1
fi

node_version=$(node --version)
echo -e "${GREEN}✅ Node.js version: $node_version${NC}"

# Check if npm/npx is available
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}❌ npm not found. Please install npm.${NC}"
    exit 1
fi

npm_version=$(npm --version)
echo -e "${GREEN}✅ npm version: $npm_version${NC}"

# Run integration tests
echo -e "${BLUE}🧪 Running integration tests...${NC}"

jest_args=(
    "--testMatch=**/avatar/*integration*.test.ts"
    "--testTimeout=60000"
    "--maxWorkers=1"
    "--detectOpenHandles"
    "--forceExit"
    "--no-cache"
    "--passWithNoTests"
)

if [ "$VERBOSE" = true ]; then
    jest_args+=("--verbose")
fi

# Execute Jest
if npx jest "${jest_args[@]}"; then
    test_exit_code=0
    echo -e "${GREEN}✅ Integration tests completed successfully!${NC}"
else
    test_exit_code=$?
    echo -e "${RED}❌ Integration tests failed with exit code $test_exit_code${NC}"
fi

# Generate simple report
echo -e "${BLUE}📊 Test Summary:${NC}"
echo "  Environment: $NODE_ENV"
echo "  Test Mode: $AVATAR_TEST_MODE"
echo "  Exit Code: $test_exit_code"
echo "  Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"

# Create summary file
summary_path="test-reports/integration/test-summary.json"
cat > "$summary_path" << EOF
{
  "timestamp": "$(date '+%Y-%m-%d %H:%M:%S')",
  "environment": "$NODE_ENV",
  "testMode": "$AVATAR_TEST_MODE",
  "exitCode": $test_exit_code,
  "success": $([ $test_exit_code -eq 0 ] && echo "true" || echo "false"),
  "platform": "$(uname -s)",
  "nodeVersion": "$node_version",
  "npmVersion": "$npm_version"
}
EOF

echo -e "${BLUE}📄 Summary saved to: $summary_path${NC}"

# Cleanup (optional)
if [ "$CLEANUP" = true ] && [ "$AVATAR_CLEANUP_TEST_DATA" != "false" ]; then
    echo -e "${BLUE}🧹 Cleaning up test data...${NC}"
    rm -rf test-data/integration 2>/dev/null || true
fi

# Restore environment (cleanup happens automatically when script exits)
unset NODE_ENV AVATAR_TEST_MODE AVATAR_LOG_LEVEL AVATAR_DISABLE_HARDWARE_CHECKS

exit $test_exit_code