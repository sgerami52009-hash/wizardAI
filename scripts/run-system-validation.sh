#!/bin/bash
# System Validation Test Runner
# Runs comprehensive system validation and acceptance tests for the personalized recommendations engine

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting System Validation Tests for Personalized Recommendations Engine${NC}"
echo -e "${CYAN}=================================================================${NC}"

# Check prerequisites
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"

# Check Node.js version
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 16 or higher.${NC}"
    exit 1
fi

node_version=$(node --version)
echo -e "${GREEN}✅ Node.js version: $node_version${NC}"

# Check npm/yarn
package_manager="npm"
if command -v yarn >/dev/null 2>&1; then
    package_manager="yarn"
fi
echo -e "${GREEN}✅ Package manager: $package_manager${NC}"

# Install dependencies if needed
echo -e "${YELLOW}📦 Checking dependencies...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    if [ "$package_manager" = "yarn" ]; then
        yarn install
    else
        npm install
    fi
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
fi

# Create necessary directories
echo -e "${YELLOW}📁 Setting up test environment...${NC}"
test_dirs=(
    "test-data/temp"
    "test-data/logs" 
    "test-data/cache"
    "coverage/system-validation"
    "recommendations/validation-reports"
)

for dir in "${test_dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "${GRAY}   Created directory: $dir${NC}"
    fi
done

# Set environment variables
export NODE_ENV="test"
export TEST_MODE="system_validation"
export LOG_LEVEL="error"

echo -e "${GREEN}✅ Test environment setup complete${NC}"

# Run TypeScript compilation check
echo -e "${YELLOW}🔧 Checking TypeScript compilation...${NC}"
if npx tsc --noEmit --project tsconfig.json; then
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
else
    echo -e "${YELLOW}⚠️ TypeScript compilation issues detected, but continuing...${NC}"
fi

# Run system validation tests
echo -e "${CYAN}🧪 Running System Validation Tests...${NC}"
echo -e "${GRAY}   This may take several minutes...${NC}"

test_start_time=$(date +%s)

# Run Jest with system validation configuration
if npx jest --config=jest.system-validation.config.js --verbose --coverage --detectOpenHandles --forceExit; then
    test_exit_code=0
else
    test_exit_code=$?
fi

test_end_time=$(date +%s)
test_duration=$((test_end_time - test_start_time))

# Display results
echo -e "\n${CYAN}=================================================================${NC}"
echo -e "${GREEN}📊 System Validation Test Results${NC}"
echo -e "${CYAN}=================================================================${NC}"

if [ $test_exit_code -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed successfully!${NC}"
else
    echo -e "${RED}❌ Some tests failed. Check the detailed report for more information.${NC}"
fi

echo -e "${CYAN}⏱️ Total execution time: $(printf '%02d:%02d' $((test_duration/60)) $((test_duration%60)))${NC}"

# Check if reports were generated
reports_dir="recommendations/validation-reports"
if [ -d "$reports_dir" ]; then
    echo -e "\n${YELLOW}📄 Generated Reports:${NC}"
    find "$reports_dir" -type f -name "*.md" -o -name "*.json" -o -name "*.html" | while read -r file; do
        echo -e "${GRAY}   - $(basename "$file")${NC}"
    done
    
    # Display summary if available
    summary_file="$reports_dir/test-results-summary.md"
    if [ -f "$summary_file" ]; then
        echo -e "\n${YELLOW}📋 Test Summary:${NC}"
        # Extract key metrics from markdown
        if grep -q "Total Tests" "$summary_file"; then
            total_tests=$(grep "Total Tests" "$summary_file" | grep -o '[0-9]\+' | head -1)
            echo -e "${GRAY}   Total Tests: $total_tests${NC}"
        fi
        if grep -q "Passed" "$summary_file"; then
            passed=$(grep "Passed" "$summary_file" | grep -o '[0-9]\+' | head -1)
            echo -e "${GREEN}   Passed: $passed${NC}"
        fi
        if grep -q "Failed" "$summary_file"; then
            failed=$(grep "Failed" "$summary_file" | grep -o '[0-9]\+' | head -1)
            echo -e "${RED}   Failed: $failed${NC}"
        fi
    fi
fi

# Check coverage report
coverage_dir="coverage/system-validation"
if [ -d "$coverage_dir" ]; then
    echo -e "\n${YELLOW}📊 Coverage Report:${NC}"
    coverage_file="$coverage_dir/lcov-report/index.html"
    if [ -f "$coverage_file" ]; then
        echo -e "${GRAY}   HTML Report: $coverage_file${NC}"
        echo -e "${GRAY}   Open this file in a browser to view detailed coverage${NC}"
    fi
fi

# Performance validation
echo -e "\n${YELLOW}⚡ Performance Validation:${NC}"
performance_report="$reports_dir/performance-report.json"
if [ -f "$performance_report" ]; then
    if command -v jq >/dev/null 2>&1; then
        peak_memory=$(jq -r '.memory.peak' "$performance_report" 2>/dev/null || echo "N/A")
        avg_response_time=$(jq -r '.performance.averageResponseTime' "$performance_report" 2>/dev/null || echo "N/A")
        memory_constraint=$(jq -r '.compliance.memoryConstraintMet' "$performance_report" 2>/dev/null || echo "false")
        response_constraint=$(jq -r '.compliance.responseTimeConstraintMet' "$performance_report" 2>/dev/null || echo "false")
        
        echo -e "${GRAY}   Peak Memory Usage: ${peak_memory}MB${NC}"
        echo -e "${GRAY}   Average Response Time: ${avg_response_time}ms${NC}"
        
        if [ "$memory_constraint" = "true" ]; then
            echo -e "${GREEN}   Memory Constraint (< 1536MB): ✅ PASSED${NC}"
        else
            echo -e "${RED}   Memory Constraint (< 1536MB): ❌ FAILED${NC}"
        fi
        
        if [ "$response_constraint" = "true" ]; then
            echo -e "${GREEN}   Response Time Constraint (< 2000ms): ✅ PASSED${NC}"
        else
            echo -e "${RED}   Response Time Constraint (< 2000ms): ❌ FAILED${NC}"
        fi
    else
        echo -e "${GRAY}   Could not parse performance report (jq not available)${NC}"
    fi
fi

# Recommendations
if [ $test_exit_code -ne 0 ]; then
    echo -e "\n${YELLOW}💡 Recommendations:${NC}"
    echo -e "${GRAY}   1. Check the detailed test report for specific failures${NC}"
    echo -e "${GRAY}   2. Review performance metrics if constraints were exceeded${NC}"
    echo -e "${GRAY}   3. Ensure all child safety validations are passing${NC}"
    echo -e "${GRAY}   4. Verify privacy compliance requirements are met${NC}"
fi

echo -e "\n${CYAN}=================================================================${NC}"
echo -e "${GREEN}System validation test execution completed.${NC}"

# Open reports in browser if requested
if [[ "$*" == *"--open-reports"* ]]; then
    html_report="$coverage_dir/html-report/system-validation-report.html"
    if [ -f "$html_report" ]; then
        echo -e "${YELLOW}🌐 Opening test report in browser...${NC}"
        if command -v xdg-open >/dev/null 2>&1; then
            xdg-open "$html_report"
        elif command -v open >/dev/null 2>&1; then
            open "$html_report"
        else
            echo -e "${GRAY}   Please open $html_report manually${NC}"
        fi
    fi
fi

# Exit with appropriate code
exit $test_exit_code