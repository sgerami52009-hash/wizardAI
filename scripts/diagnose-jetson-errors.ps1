# Jetson Deployment Error Diagnostic Script (PowerShell)
# Identifies and categorizes deployment errors on Jetson hardware

param(
    [string]$JetsonHost = "jetson-nano.local",
    [string]$JetsonUser = "shervin",
    [switch]$Verbose,
    [switch]$Help
)

if ($Help) {
    Write-Host "Jetson Deployment Error Diagnostic Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\scripts\diagnose-jetson-errors.ps1 [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "Parameters:" -ForegroundColor Yellow
    Write-Host "  -JetsonHost    Jetson device hostname or IP (default: jetson-nano.local)" -ForegroundColor White
    Write-Host "  -JetsonUser    SSH username (default: shervin)" -ForegroundColor White
    Write-Host "  -Verbose       Enable verbose output" -ForegroundColor White
    Write-Host "  -Help          Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\scripts\diagnose-jetson-errors.ps1" -ForegroundColor White
    Write-Host "  .\scripts\diagnose-jetson-errors.ps1 -JetsonHost 192.168.1.100 -Verbose" -ForegroundColor White
    exit 0
}

$LogFile = "jetson-deployment-errors.log"
$ErrorCount = 0
$WarningCount = 0

function Write-DiagLog {
    param(
        [string]$Message,
        [string]$Level = "Info"
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $logEntry = "[$timestamp] $Message"
    
    switch ($Level) {
        "Success" { 
            Write-Host "[$timestamp] [SUCCESS] $Message" -ForegroundColor Green
            Add-Content -Path $LogFile -Value "[SUCCESS] $Message"
        }
        "Error" { 
            Write-Host "[$timestamp] [ERROR] $Message" -ForegroundColor Red
            Add-Content -Path $LogFile -Value "[ERROR] $Message"
            $script:ErrorCount++
        }
        "Warning" { 
            Write-Host "[$timestamp] [WARNING] $Message" -ForegroundColor Yellow
            Add-Content -Path $LogFile -Value "[WARNING] $Message"
            $script:WarningCount++
        }
        default { 
            Write-Host "[$timestamp] $Message" -ForegroundColor Blue
            Add-Content -Path $LogFile -Value "$Message"
        }
    }
}

function Test-JetsonCommand {
    param(
        [string]$Command,
        [string]$Description
    )
    
    Write-DiagLog "Checking: $Description"
    
    try {
        if (Get-Command ssh -ErrorAction SilentlyContinue) {
            $result = & ssh -o ConnectTimeout=10 "$JetsonUser@$JetsonHost" $Command 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-DiagLog "$Description - OK" "Success"
                if ($Verbose) {
                    Write-DiagLog "Output: $result"
                }
                return $true
            } else {
                Write-DiagLog "$Description - FAILED" "Error"
                Write-DiagLog "Error output: $result" "Error"
                return $false
            }
        } else {
            Write-DiagLog "SSH client not available. Please install OpenSSH." "Error"
            return $false
        }
    } catch {
        Write-DiagLog "$Description - Exception: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Test-Connectivity {
    Write-DiagLog "=== CONNECTIVITY CHECK ==="
    
    # Test network connectivity
    try {
        $ping = Test-Connection -ComputerName $JetsonHost -Count 2 -Quiet
        if ($ping) {
            Write-DiagLog "Network connectivity to $JetsonHost" "Success"
        } else {
            Write-DiagLog "Cannot reach $JetsonHost" "Error"
            return $false
        }
    } catch {
        Write-DiagLog "Network test failed: $($_.Exception.Message)" "Error"
        return $false
    }
    
    # Test SSH connectivity
    if (Get-Command ssh -ErrorAction SilentlyContinue) {
        try {
            $sshTest = & ssh -o ConnectTimeout=5 -o BatchMode=yes "$JetsonUser@$JetsonHost" "echo 'SSH OK'" 2>$null
            if ($sshTest -eq "SSH OK") {
                Write-DiagLog "SSH connectivity" "Success"
                return $true
            } else {
                Write-DiagLog "SSH connection failed" "Error"
                return $false
            }
        } catch {
            Write-DiagLog "SSH test failed: $($_.Exception.Message)" "Error"
            return $false
        }
    } else {
        Write-DiagLog "SSH client not found. Install with: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0" "Warning"
        return $false
    }
}

function Test-SystemInfo {
    Write-DiagLog "=== SYSTEM INFORMATION ==="
    
    Test-JetsonCommand "cat /etc/nv_tegra_release" "JetPack version"
    Test-JetsonCommand "uname -a" "Kernel information"
    Test-JetsonCommand "free -h" "Memory status"
    Test-JetsonCommand "df -h" "Disk space"
    Test-JetsonCommand "nvidia-smi" "GPU status"
}

function Test-NodeJSIssues {
    Write-DiagLog "=== NODE.JS DIAGNOSTICS ==="
    
    Test-JetsonCommand "node --version" "Node.js version"
    Test-JetsonCommand "npm --version" "npm version"
    Test-JetsonCommand "which node" "Node.js location"
    Test-JetsonCommand "which npm" "npm location"
    Test-JetsonCommand "npm config list" "npm configuration"
    Test-JetsonCommand "ls -la ~/.npm" "npm cache permissions"
    Test-JetsonCommand "npm list -g --depth=0" "Global npm packages"
}

function Test-TypeScriptIssues {
    Write-DiagLog "=== TYPESCRIPT DIAGNOSTICS ==="
    
    Test-JetsonCommand "ls -la /home/$JetsonUser/home-assistant/" "Project directory"
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && npx tsc --version" "TypeScript version"
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && cat tsconfig.json" "TypeScript configuration"
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && find . -name '*.ts' -type f | head -10" "TypeScript files"
    
    Write-DiagLog "Attempting TypeScript compilation with error details..."
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && npx tsc --noEmit --listFiles" "TypeScript compilation test"
}

function Test-DependencyIssues {
    Write-DiagLog "=== DEPENDENCY DIAGNOSTICS ==="
    
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && cat package.json" "Package.json content"
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && ls -la node_modules/ | head -20" "Node modules directory"
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && npm ls --depth=0" "Installed packages"
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && npm ls --depth=0 2>&1 | grep -i 'peer\|missing\|error' || echo 'No peer dependency issues found'" "Peer dependencies"
}

function Test-DockerIssues {
    Write-DiagLog "=== DOCKER DIAGNOSTICS ==="
    
    Test-JetsonCommand "docker --version" "Docker version"
    Test-JetsonCommand "docker info" "Docker system info"
    Test-JetsonCommand "docker ps -a" "Docker containers"
    Test-JetsonCommand "docker images" "Docker images"
    Test-JetsonCommand "systemctl status docker" "Docker service status"
    Test-JetsonCommand "docker info | grep -i nvidia" "NVIDIA Docker runtime"
}

function Test-BuildProcess {
    Write-DiagLog "=== BUILD PROCESS DIAGNOSTICS ==="
    
    Write-DiagLog "Cleaning previous build artifacts..."
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && rm -rf dist/ node_modules/ package-lock.json" "Clean build artifacts"
    
    Write-DiagLog "Installing dependencies with verbose output..."
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && npm install --verbose" "Install dependencies"
    
    Write-DiagLog "Attempting build with detailed error output..."
    Test-JetsonCommand "cd /home/$JetsonUser/home-assistant && npm run build" "Build application"
}

function Invoke-ErrorAnalysis {
    Write-DiagLog "=== ERROR PATTERN ANALYSIS ==="
    
    if (Test-Path $LogFile) {
        Write-DiagLog "Analyzing error patterns from log..."
        
        $logContent = Get-Content $LogFile
        
        Write-DiagLog "Error Summary:"
        Write-DiagLog "============="
        
        $totalErrors = ($logContent | Select-String -Pattern "error" -AllMatches).Count
        $cannotFindErrors = ($logContent | Select-String -Pattern "cannot find" -AllMatches).Count
        $moduleNotFoundErrors = ($logContent | Select-String -Pattern "module.*not found" -AllMatches).Count
        $permissionErrors = ($logContent | Select-String -Pattern "permission denied" -AllMatches).Count
        $syntaxErrors = ($logContent | Select-String -Pattern "syntax error" -AllMatches).Count
        $typeErrors = ($logContent | Select-String -Pattern "type.*error" -AllMatches).Count
        
        Write-DiagLog "Total 'error' mentions: $totalErrors"
        Write-DiagLog "Cannot find errors: $cannotFindErrors"
        Write-DiagLog "Module not found errors: $moduleNotFoundErrors"
        Write-DiagLog "Permission errors: $permissionErrors"
        Write-DiagLog "Syntax errors: $syntaxErrors"
        Write-DiagLog "Type errors: $typeErrors"
        
        Write-DiagLog ""
        Write-DiagLog "Most common error patterns:"
        $errorPatterns = $logContent | Select-String -Pattern "error" | Group-Object | Sort-Object Count -Descending | Select-Object -First 10
        foreach ($pattern in $errorPatterns) {
            Write-DiagLog "$($pattern.Count): $($pattern.Name)"
        }
    }
}

function New-FixRecommendations {
    Write-DiagLog "=== FIX RECOMMENDATIONS ==="
    
    Write-DiagLog "Recommended fixes based on analysis:"
    Write-DiagLog "===================================="
    
    $logContent = if (Test-Path $LogFile) { Get-Content $LogFile } else { @() }
    
    # Check for TypeScript issues
    if ($logContent -match "TS[0-9]") {
        Write-DiagLog "1. TypeScript compilation errors detected:"
        Write-DiagLog "   - Run: npm install typescript@latest"
        Write-DiagLog "   - Check tsconfig.json compatibility"
        Write-DiagLog "   - Verify all .ts files have proper syntax"
    }
    
    # Check for dependency issues
    if ($logContent -match "MODULE_NOT_FOUND|Cannot resolve") {
        Write-DiagLog "2. Dependency issues detected:"
        Write-DiagLog "   - Run: rm -rf node_modules package-lock.json"
        Write-DiagLog "   - Run: npm cache clean --force"
        Write-DiagLog "   - Run: npm install"
    }
    
    # Check for memory issues
    if ($logContent -match "out of memory|heap limit") {
        Write-DiagLog "3. Memory issues detected:"
        Write-DiagLog "   - Increase Node.js memory: export NODE_OPTIONS='--max-old-space-size=4096'"
        Write-DiagLog "   - Add swap space if needed"
    }
    
    # Check for permission issues
    if ($logContent -match "permission denied|EACCES") {
        Write-DiagLog "4. Permission issues detected:"
        Write-DiagLog "   - Fix npm permissions: sudo chown -R `$USER ~/.npm"
        Write-DiagLog "   - Fix project permissions: sudo chown -R `$USER /home/$JetsonUser/home-assistant"
    }
    
    Write-DiagLog ""
    Write-DiagLog "Quick fix command:"
    Write-DiagLog ".\scripts\fix-jetson-errors.ps1 -JetsonHost $JetsonHost -JetsonUser $JetsonUser"
}

# Main execution
Write-DiagLog "Starting comprehensive Jetson deployment error diagnosis"
Write-DiagLog "Target: $JetsonUser@$JetsonHost"

# Initialize log file
"Jetson Deployment Error Diagnosis - $(Get-Date)" | Out-File -FilePath $LogFile -Encoding UTF8
"=========================================" | Add-Content -Path $LogFile

if (-not (Test-Connectivity)) {
    Write-DiagLog "Cannot establish connection to Jetson device" "Error"
    exit 1
}

Test-SystemInfo
Test-NodeJSIssues
Test-TypeScriptIssues
Test-DependencyIssues
Test-DockerIssues
Test-BuildProcess
Invoke-ErrorAnalysis
New-FixRecommendations

Write-DiagLog "Diagnosis complete. Check $LogFile for detailed results."
Write-DiagLog "Errors found: $ErrorCount, Warnings: $WarningCount"

if ($ErrorCount -gt 0) {
    Write-DiagLog "Run the fix script to resolve issues: .\scripts\fix-jetson-errors.ps1" "Warning"
    exit 1
} else {
    Write-DiagLog "No critical errors found. Deployment should work." "Success"
    exit 0
}