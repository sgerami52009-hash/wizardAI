#!/bin/bash

# Jetson Deployment Error Diagnostic Script
# Identifies and categorizes the 388 errors in 45 files

set -e

# Configuration
JETSON_HOST="${JETSON_HOST:-jetson-nano.local}"
JETSON_USER="${JETSON_USER:-shervin}"
LOG_FILE="jetson-deployment-errors.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Initialize log file
echo "Jetson Deployment Error Diagnosis - $(date)" > "$LOG_FILE"
echo "=========================================" >> "$LOG_FILE"

log "Starting comprehensive error diagnosis..."

# Function to run command on Jetson and capture errors
run_jetson_command() {
    local command="$1"
    local description="$2"
    
    log "Checking: $description"
    
    if ssh -o ConnectTimeout=10 "$JETSON_USER@$JETSON_HOST" "$command" 2>&1 | tee -a "$LOG_FILE"; then
        log_success "$description - OK"
        return 0
    else
        log_error "$description - FAILED"
        return 1
    fi
}

# 1. Check basic connectivity
check_connectivity() {
    log "=== CONNECTIVITY CHECK ==="
    
    if ping -c 2 "$JETSON_HOST" &>/dev/null; then
        log_success "Network connectivity to $JETSON_HOST"
    else
        log_error "Cannot reach $JETSON_HOST"
        return 1
    fi
    
    if ssh -o ConnectTimeout=5 "$JETSON_USER@$JETSON_HOST" "echo 'SSH OK'" &>/dev/null; then
        log_success "SSH connectivity"
    else
        log_error "SSH connection failed"
        return 1
    fi
}

# 2. Check system information
check_system_info() {
    log "=== SYSTEM INFORMATION ==="
    
    run_jetson_command "cat /etc/nv_tegra_release" "JetPack version"
    run_jetson_command "uname -a" "Kernel information"
    run_jetson_command "free -h" "Memory status"
    run_jetson_command "df -h" "Disk space"
    run_jetson_command "nvidia-smi" "GPU status"
}

# 3. Check Node.js and npm issues
check_nodejs_issues() {
    log "=== NODE.JS DIAGNOSTICS ==="
    
    run_jetson_command "node --version" "Node.js version"
    run_jetson_command "npm --version" "npm version"
    
    # Check for common Node.js issues
    run_jetson_command "which node" "Node.js location"
    run_jetson_command "which npm" "npm location"
    
    # Check npm configuration
    run_jetson_command "npm config list" "npm configuration"
    
    # Check for permission issues
    run_jetson_command "ls -la ~/.npm" "npm cache permissions"
    
    # Check global packages
    run_jetson_command "npm list -g --depth=0" "Global npm packages"
}

# 4. Check TypeScript compilation issues
check_typescript_issues() {
    log "=== TYPESCRIPT DIAGNOSTICS ==="
    
    # Check if project exists
    run_jetson_command "ls -la /home/$JETSON_USER/home-assistant/" "Project directory"
    
    # Check TypeScript installation
    run_jetson_command "cd /home/$JETSON_USER/home-assistant && npx tsc --version" "TypeScript version"
    
    # Check tsconfig.json
    run_jetson_command "cd /home/$JETSON_USER/home-assistant && cat tsconfig.json" "TypeScript configuration"
    
    # Check for syntax errors in TypeScript files
    run_jetson_command "cd /home/$JETSON_USER/home-assistant && find . -name '*.ts' -type f | head -10" "TypeScript files"
    
    # Try compilation with verbose output
    log "Attempting TypeScript compilation with error details..."
    ssh "$JETSON_USER@$JETSON_HOST" "cd /home/$JETSON_USER/home-assistant && npx tsc --noEmit --listFiles 2>&1" | tee -a "$LOG_FILE" || true
}

# 5. Check dependency issues
check_dependency_issues() {
    log "=== DEPENDENCY DIAGNOSTICS ==="
    
    # Check package.json
    run_jetson_command "cd /home/$JETSON_USER/home-assistant && cat package.json" "Package.json content"
    
    # Check node_modules
    run_jetson_command "cd /home/$JETSON_USER/home-assistant && ls -la node_modules/ | head -20" "Node modules directory"
    
    # Check for missing dependencies
    run_jetson_command "cd /home/$JETSON_USER/home-assistant && npm ls --depth=0" "Installed packages"
    
    # Check for peer dependency issues
    run_jetson_command "cd /home/$JETSON_USER/home-assistant && npm ls --depth=0 2>&1 | grep -i 'peer\\|missing\\|error' || echo 'No peer dependency issues found'" "Peer dependencies"
}

# 6. Check Docker issues
check_docker_issues() {
    log "=== DOCKER DIAGNOSTICS ==="
    
    run_jetson_command "docker --version" "Docker version"
    run_jetson_command "docker info" "Docker system info"
    run_jetson_command "docker ps -a" "Docker containers"
    run_jetson_command "docker images" "Docker images"
    
    # Check Docker daemon status
    run_jetson_command "systemctl status docker" "Docker service status"
    
    # Check NVIDIA Docker runtime
    run_jetson_command "docker info | grep -i nvidia" "NVIDIA Docker runtime"
}

# 7. Check build process step by step
check_build_process() {
    log "=== BUILD PROCESS DIAGNOSTICS ==="
    
    # Clean previous build
    log "Cleaning previous build artifacts..."
    ssh "$JETSON_USER@$JETSON_HOST" "cd /home/$JETSON_USER/home-assistant && rm -rf dist/ node_modules/ package-lock.json" 2>&1 | tee -a "$LOG_FILE" || true
    
    # Install dependencies step by step
    log "Installing dependencies with verbose output..."
    ssh "$JETSON_USER@$JETSON_HOST" "cd /home/$JETSON_USER/home-assistant && npm install --verbose 2>&1" | tee -a "$LOG_FILE" || true
    
    # Try building with detailed error output
    log "Attempting build with detailed error output..."
    ssh "$JETSON_USER@$JETSON_HOST" "cd /home/$JETSON_USER/home-assistant && npm run build 2>&1" | tee -a "$LOG_FILE" || true
}

# 8. Analyze error patterns
analyze_errors() {
    log "=== ERROR PATTERN ANALYSIS ==="
    
    if [ -f "$LOG_FILE" ]; then
        log "Analyzing error patterns from log..."
        
        # Count different types of errors
        echo "Error Summary:" | tee -a "$LOG_FILE"
        echo "=============" | tee -a "$LOG_FILE"
        
        grep -i "error" "$LOG_FILE" | wc -l | xargs echo "Total 'error' mentions:" | tee -a "$LOG_FILE"
        grep -i "cannot find" "$LOG_FILE" | wc -l | xargs echo "Cannot find errors:" | tee -a "$LOG_FILE"
        grep -i "module.*not found" "$LOG_FILE" | wc -l | xargs echo "Module not found errors:" | tee -a "$LOG_FILE"
        grep -i "permission denied" "$LOG_FILE" | wc -l | xargs echo "Permission errors:" | tee -a "$LOG_FILE"
        grep -i "syntax error" "$LOG_FILE" | wc -l | xargs echo "Syntax errors:" | tee -a "$LOG_FILE"
        grep -i "type.*error" "$LOG_FILE" | wc -l | xargs echo "Type errors:" | tee -a "$LOG_FILE"
        
        echo "" | tee -a "$LOG_FILE"
        echo "Most common error patterns:" | tee -a "$LOG_FILE"
        grep -i "error" "$LOG_FILE" | sort | uniq -c | sort -nr | head -10 | tee -a "$LOG_FILE"
    fi
}

# 9. Generate fix recommendations
generate_recommendations() {
    log "=== FIX RECOMMENDATIONS ==="
    
    echo "Recommended fixes based on analysis:" | tee -a "$LOG_FILE"
    echo "====================================" | tee -a "$LOG_FILE"
    
    # Check if it's a TypeScript issue
    if grep -q "TS[0-9]" "$LOG_FILE" 2>/dev/null; then
        echo "1. TypeScript compilation errors detected:" | tee -a "$LOG_FILE"
        echo "   - Run: npm install typescript@latest" | tee -a "$LOG_FILE"
        echo "   - Check tsconfig.json compatibility" | tee -a "$LOG_FILE"
        echo "   - Verify all .ts files have proper syntax" | tee -a "$LOG_FILE"
    fi
    
    # Check if it's a dependency issue
    if grep -q "MODULE_NOT_FOUND\\|Cannot resolve" "$LOG_FILE" 2>/dev/null; then
        echo "2. Dependency issues detected:" | tee -a "$LOG_FILE"
        echo "   - Run: rm -rf node_modules package-lock.json" | tee -a "$LOG_FILE"
        echo "   - Run: npm cache clean --force" | tee -a "$LOG_FILE"
        echo "   - Run: npm install" | tee -a "$LOG_FILE"
    fi
    
    # Check if it's a memory issue
    if grep -q "out of memory\\|heap limit" "$LOG_FILE" 2>/dev/null; then
        echo "3. Memory issues detected:" | tee -a "$LOG_FILE"
        echo "   - Increase Node.js memory: export NODE_OPTIONS='--max-old-space-size=4096'" | tee -a "$LOG_FILE"
        echo "   - Add swap space if needed" | tee -a "$LOG_FILE"
    fi
    
    # Check if it's a permission issue
    if grep -q "permission denied\\|EACCES" "$LOG_FILE" 2>/dev/null; then
        echo "4. Permission issues detected:" | tee -a "$LOG_FILE"
        echo "   - Fix npm permissions: sudo chown -R \$USER ~/.npm" | tee -a "$LOG_FILE"
        echo "   - Fix project permissions: sudo chown -R \$USER /home/$JETSON_USER/home-assistant" | tee -a "$LOG_FILE"
    fi
}

# Main execution
main() {
    log "Starting comprehensive Jetson deployment error diagnosis"
    log "Target: $JETSON_USER@$JETSON_HOST"
    
    check_connectivity || exit 1
    check_system_info
    check_nodejs_issues
    check_typescript_issues
    check_dependency_issues
    check_docker_issues
    check_build_process
    analyze_errors
    generate_recommendations
    
    log "Diagnosis complete. Check $LOG_FILE for detailed results."
    log "Run the recommended fixes and try deployment again."
}

# Run diagnostics
main "$@"