#!/bin/bash

# Comprehensive Deployment Validation for Jetson Home Assistant
# Tests the full program deployment in a virtual Jetson Orin Nano environment

set -e

# Configuration
SCRIPT_NAME="Comprehensive Deployment Validation"
VALIDATION_SCRIPT="scripts/comprehensive-deployment-validation.js"
LOG_DIR="logs/validation"
TIMEOUT_MINUTES=10
VERBOSE=false
SKIP_CLEANUP=false

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        --skip-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        -t|--timeout)
            TIMEOUT_MINUTES="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [OPTIONS]"
            echo "Options:"
            echo "  -v, --verbose      Enable verbose output"
            echo "  --skip-cleanup     Skip cleanup after validation"
            echo "  -t, --timeout MIN  Timeout in minutes (default: 10)"
            echo "  -h, --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Utility functions
log_info() {
    echo -e "${CYAN}$1${NC}"
}

log_success() {
    echo -e "${GREEN}$1${NC}"
}

log_warning() {
    echo -e "${YELLOW}$1${NC}"
}

log_error() {
    echo -e "${RED}$1${NC}"
}

log_header() {
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}$(echo "$1" | sed 's/./=/g')${NC}"
}

# Check prerequisites
check_prerequisites() {
    log_info "🔍 Checking Prerequisites..."
    
    local all_passed=true
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        log_success "  ✅ Node.js: $node_version"
    else
        log_error "  ❌ Node.js: Not found"
        all_passed=false
    fi
    
    # Check npm
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version)
        log_success "  ✅ NPM: $npm_version"
    else
        log_error "  ❌ NPM: Not found"
        all_passed=false
    fi
    
    # Check required files
    local required_files=(
        "package.json"
        "dist/index.js"
        "dist/health-check.js"
        "simple-jetson-test.js"
        "$VALIDATION_SCRIPT"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            log_success "  ✅ File: $file"
        else
            log_error "  ❌ File missing: $file"
            all_passed=false
        fi
    done
    
    if [[ "$all_passed" != true ]]; then
        log_error "Prerequisites check failed. Please install missing components."
        exit 1
    fi
    
    log_success "✅ All prerequisites satisfied"
    echo
}

# Prepare environment
prepare_environment() {
    log_info "🔧 Preparing Validation Environment..."
    
    # Create directories
    mkdir -p "$LOG_DIR"
    mkdir -p "temp/validation"
    mkdir -p "cache/validation"
    
    log_info "  📁 Created necessary directories"
    
    # Check ports
    local required_ports=(3000 8080)
    for port in "${required_ports[@]}"; do
        if command -v netstat >/dev/null 2>&1; then
            if netstat -ln 2>/dev/null | grep -q ":$port "; then
                log_warning "  ⚠️  Port $port is in use - validation may fail"
            else
                log_success "  ✅ Port $port is available"
            fi
        else
            log_info "  ℹ️  Cannot check port $port (netstat not available)"
        fi
    done
    
    log_success "✅ Environment prepared"
    echo
}

# Run validation with timeout
run_validation() {
    log_info "🧪 Starting Comprehensive Validation..."
    log_info "Timeout: $TIMEOUT_MINUTES minutes"
    echo
    
    local timeout_seconds=$((TIMEOUT_MINUTES * 60))
    
    # Run validation with timeout
    if timeout "$timeout_seconds" node "$VALIDATION_SCRIPT"; then
        return 0
    else
        local exit_code=$?
        if [[ $exit_code -eq 124 ]]; then
            log_error "⏰ Validation timed out after $TIMEOUT_MINUTES minutes"
            return 2
        else
            log_error "❌ Validation failed with exit code: $exit_code"
            return $exit_code
        fi
    fi
}

# Analyze results
analyze_results() {
    log_info "📊 Analyzing Validation Results..."
    
    # Find latest report
    local latest_report=$(find "$LOG_DIR" -name "deployment-validation-*.json" -type f 2>/dev/null | sort -r | head -n1)
    
    if [[ -z "$latest_report" ]]; then
        log_warning "  ⚠️  No validation report found"
        return 1
    fi
    
    log_info "  📄 Reading report: $(basename "$latest_report")"
    
    if command -v jq >/dev/null 2>&1; then
        # Use jq for JSON parsing if available
        local overall_status=$(jq -r '.overallStatus' "$latest_report")
        local total_tests=$(jq -r '.totalTests' "$latest_report")
        local passed_tests=$(jq -r '.passedTests' "$latest_report")
        local failed_tests=$(jq -r '.failedTests' "$latest_report")
        local skipped_tests=$(jq -r '.skippedTests' "$latest_report")
        local deployment_status=$(jq -r '.deploymentStatus' "$latest_report")
        
        log_header "📋 VALIDATION SUMMARY"
        echo "Overall Status: $overall_status"
        echo "Total Tests: $total_tests"
        echo "Passed: $passed_tests"
        echo "Failed: $failed_tests"
        echo "Skipped: $skipped_tests"
        echo "Deployment Status: $deployment_status"
        
        if [[ "$total_tests" -gt 0 ]]; then
            local executed_tests=$((passed_tests + failed_tests))
            if [[ "$executed_tests" -gt 0 ]]; then
                local success_rate=$(echo "scale=1; $passed_tests * 100 / $executed_tests" | bc 2>/dev/null || echo "N/A")
                echo "Success Rate: $success_rate%"
            fi
        fi
        
    else
        # Fallback without jq
        log_info "  📄 Report generated (install 'jq' for detailed analysis)"
        if grep -q '"overallStatus":"PASSED"' "$latest_report"; then
            log_success "  ✅ Overall Status: PASSED"
        else
            log_error "  ❌ Overall Status: FAILED"
        fi
    fi
    
    echo
}

# Cleanup
cleanup() {
    if [[ "$SKIP_CLEANUP" == true ]]; then
        log_warning "⏭️  Skipping cleanup (as requested)"
        return
    fi
    
    log_info "🧹 Cleaning up..."
    
    # Kill Node.js processes that might be from our validation
    local node_pids=$(pgrep -f "node.*$VALIDATION_SCRIPT" 2>/dev/null || true)
    if [[ -n "$node_pids" ]]; then
        log_info "  🔪 Stopping validation processes..."
        echo "$node_pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        echo "$node_pids" | xargs kill -KILL 2>/dev/null || true
    fi
    
    # Clean temporary directories
    rm -rf "temp/validation" 2>/dev/null || true
    rm -rf "cache/validation" 2>/dev/null || true
    
    log_success "✅ Cleanup completed"
}

# Main execution
main() {
    local start_time=$(date)
    
    log_header "🚀 $SCRIPT_NAME"
    echo "Start Time: $start_time"
    echo "Timeout: $TIMEOUT_MINUTES minutes"
    echo
    
    # Trap for cleanup
    trap cleanup EXIT
    
    # Run validation steps
    check_prerequisites
    prepare_environment
    
    local validation_exit_code=0
    run_validation || validation_exit_code=$?
    
    analyze_results
    
    local end_time=$(date)
    echo
    log_header "🏁 VALIDATION COMPLETED"
    echo "End Time: $end_time"
    
    # Determine final result
    case $validation_exit_code in
        0)
            log_success "✅ VALIDATION PASSED"
            log_success "🚀 The Home Assistant is ready for production deployment!"
            echo
            log_header "📋 NEXT STEPS"
            log_success "1. ✅ Virtual validation passed - system is ready"
            echo "2. 🚀 Deploy to physical Jetson Orin Nano:"
            echo "   ./deployment/deploy-jetson-ip.sh -i <JETSON_IP> -u jetson"
            echo "3. 📱 Or create USB installer:"
            echo "   ./deployment/create-usb-installer.sh -u /media/usb"
            ;;
        2)
            log_error "❌ VALIDATION TIMED OUT"
            log_error "The validation process exceeded the $TIMEOUT_MINUTES minute timeout."
            ;;
        *)
            log_error "❌ VALIDATION FAILED"
            log_error "Please review the test results and fix issues before deployment."
            echo
            log_header "📋 NEXT STEPS"
            log_warning "1. 🔍 Review validation report in: $LOG_DIR"
            log_warning "2. 🔧 Fix identified issues"
            log_warning "3. 🔄 Re-run validation: ./scripts/run-comprehensive-validation.sh"
            ;;
    esac
    
    echo
    if [[ $validation_exit_code -eq 0 ]]; then
        log_success "📊 Final Status: SUCCESS ✅"
    else
        log_error "📊 Final Status: FAILED ❌"
    fi
    
    exit $validation_exit_code
}

# Run main function
main "$@"