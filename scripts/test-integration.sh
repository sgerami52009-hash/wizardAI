#!/bin/bash

# Avatar System Integration Test Runner
# Simple script to run integration tests with proper setup

set -e

echo "🚀 Avatar System Integration Tests"
echo "=================================="

# Set environment variables
export NODE_ENV=test
export AVATAR_TEST_MODE=true
export AVATAR_LOG_LEVEL=warn
export AVATAR_DISABLE_HARDWARE_CHECKS=true

# Create test directories
echo "📁 Creating test directories..."
mkdir -p test-data/integration
mkdir -p test-reports/integration
mkdir -p coverage/integration

# Check if Jest is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js and npm."
    exit 1
fi

# Run integration tests with Jest
echo "🧪 Running integration tests..."

# Use a simplified Jest command that should work
npx jest \
  --testMatch="**/avatar/*integration*.test.ts" \
  --testTimeout=60000 \
  --maxWorkers=1 \
  --verbose \
  --detectOpenHandles \
  --forceExit \
  --no-cache \
  --passWithNoTests

TEST_EXIT_CODE=$?

echo ""
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Integration tests completed successfully!"
else
    echo "❌ Integration tests failed with exit code $TEST_EXIT_CODE"
fi

# Generate simple report
echo "📊 Test Summary:"
echo "  Environment: $NODE_ENV"
echo "  Test Mode: $AVATAR_TEST_MODE"
echo "  Exit Code: $TEST_EXIT_CODE"

# Cleanup (optional)
if [ "$AVATAR_CLEANUP_TEST_DATA" != "false" ]; then
    echo "🧹 Cleaning up test data..."
    rm -rf test-data/integration
fi

exit $TEST_EXIT_CODE