# JetPack 5 Deployment Script for Windows PowerShell
# Deploy Home Assistant to Jetson Nano Orin with JetPack 5

param(
    [string]$JetsonHost = "jetson-nano.local",
    [string]$JetsonUser = "shervin",
    [switch]$Help
)

if ($Help) {
    Write-Host "JetPack 5 Deployment Script for Jetson Nano Orin" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\deployment\deploy-jetpack5.ps1 [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "Parameters:" -ForegroundColor Yellow
    Write-Host "  -JetsonHost    Jetson device hostname or IP (default: jetson-nano.local)" -ForegroundColor White
    Write-Host "  -JetsonUser    SSH username (default: shervin)" -ForegroundColor White
    Write-Host "  -Help          Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\deployment\deploy-jetpack5.ps1 -JetsonHost 192.168.1.100" -ForegroundColor White
    Write-Host "  .\deployment\deploy-jetpack5.ps1 -JetsonUser shervin -JetsonHost jetson.local" -ForegroundColor White
    Write-Host ""
    Write-Host "This script is optimized for JetPack 5.1 with:" -ForegroundColor Green
    Write-Host "  - CUDA 11.4" -ForegroundColor White
    Write-Host "  - TensorRT 8.5" -ForegroundColor White
    Write-Host "  - Ubuntu 20.04" -ForegroundColor White
    Write-Host "  - Node.js 18 LTS" -ForegroundColor White
    exit 0
}

$DeployDir = "/home/$JetsonUser/home-assistant"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "HH:mm:ss"
    switch ($Level) {
        "SUCCESS" { Write-Host "[$timestamp] [SUCCESS] $Message" -ForegroundColor Green }
        "ERROR" { Write-Host "[$timestamp] [ERROR] $Message" -ForegroundColor Red }
        "WARNING" { Write-Host "[$timestamp] [WARNING] $Message" -ForegroundColor Yellow }
        default { Write-Host "[$timestamp] $Message" -ForegroundColor Blue }
    }
}

function Test-JetsonConnection {
    Write-Log "Testing connection to Jetson at $JetsonHost..."
    
    # Test ping
    try {
        $ping = Test-Connection -ComputerName $JetsonHost -Count 1 -Quiet
        if ($ping) {
            Write-Log "Ping successful to $JetsonHost" "SUCCESS"
        } else {
            Write-Log "Cannot reach Jetson at $JetsonHost" "ERROR"
            Write-Log "Please ensure the device is powered on and connected to the network" "ERROR"
            exit 1
        }
    } catch {
        Write-Log "Network test failed: $($_.Exception.Message)" "ERROR"
        exit 1
    }
    
    # Test SSH (using plink if available, otherwise provide instructions)
    $sshTest = $null
    try {
        if (Get-Command plink -ErrorAction SilentlyContinue) {
            $sshTest = & plink -batch -ssh "$JetsonUser@$JetsonHost" "echo 'SSH OK'" 2>$null
        } elseif (Get-Command ssh -ErrorAction SilentlyContinue) {
            $sshTest = & ssh -o ConnectTimeout=5 -o BatchMode=yes "$JetsonUser@$JetsonHost" "echo 'SSH OK'" 2>$null
        } else {
            Write-Log "SSH client not found. Please install OpenSSH or PuTTY" "WARNING"
            Write-Log "You can install OpenSSH with: Add-WindowsCapability -Online -Name OpenSSH.Client~~~~0.0.1.0" "WARNING"
        }
        
        if ($sshTest -eq "SSH OK") {
            Write-Log "SSH connection successful" "SUCCESS"
        } else {
            Write-Log "SSH connection failed to $JetsonUser@$JetsonHost" "ERROR"
            Write-Log "Please ensure SSH is enabled and you have the correct credentials" "ERROR"
            exit 1
        }
    } catch {
        Write-Log "SSH test failed: $($_.Exception.Message)" "WARNING"
    }
}

function Build-Application {
    Write-Log "Building application for JetPack 5..."
    
    Set-Location $ProjectRoot
    
    # Check if package.json exists
    if (-not (Test-Path "package.json")) {
        Write-Log "package.json not found. Please run from project root directory." "ERROR"
        exit 1
    }
    
    # Install dependencies
    Write-Log "Installing dependencies..."
    & npm ci
    if ($LASTEXITCODE -ne 0) {
        Write-Log "npm ci failed" "ERROR"
        exit 1
    }
    
    # Build the application
    Write-Log "Building application..."
    $env:NODE_OPTIONS = "--max-old-space-size=4096"
    & npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Build failed" "ERROR"
        exit 1
    }
    
    # Verify build
    if (-not (Test-Path "dist\index.js")) {
        Write-Log "Build failed - dist\index.js not found" "ERROR"
        exit 1
    }
    
    Write-Log "Application built successfully" "SUCCESS"
}

function Deploy-ToJetson {
    Write-Log "Starting deployment to Jetson..."
    
    # Create deployment command for Linux
    $deployCommand = @"
#!/bin/bash
set -e

# Set environment variables
export JETSON_HOST="$JetsonHost"
export JETSON_USER="$JetsonUser"

# Run the JetPack 5 deployment script
cd "$($ProjectRoot.Replace('\', '/'))"
bash deployment/deploy-jetson-jetpack5.sh
"@
    
    # Save deployment command to temporary file
    $tempScript = Join-Path $env:TEMP "deploy-jetpack5-temp.sh"
    $deployCommand | Out-File -FilePath $tempScript -Encoding UTF8
    
    Write-Log "Deployment script created. You have two options:" "WARNING"
    Write-Log ""
    Write-Log "Option 1 - Use WSL (Windows Subsystem for Linux):" "WARNING"
    Write-Log "  wsl bash deployment/deploy-jetson-jetpack5.sh" "WARNING"
    Write-Log ""
    Write-Log "Option 2 - Use Git Bash or similar:" "WARNING"
    Write-Log "  bash deployment/deploy-jetson-jetpack5.sh" "WARNING"
    Write-Log ""
    Write-Log "Option 3 - Manual deployment steps:" "WARNING"
    Write-Log "  1. Copy files to Jetson: scp -r dist config package*.json $JetsonUser@${JetsonHost}:~/home-assistant/" "WARNING"
    Write-Log "  2. SSH to Jetson: ssh $JetsonUser@$JetsonHost" "WARNING"
    Write-Log "  3. Run: cd ~/home-assistant && docker compose -f deployment/docker-compose.jetpack5.yml up -d" "WARNING"
}

# Main execution
Write-Log "Starting JetPack 5 deployment from Windows..." "SUCCESS"
Write-Log "Target: $JetsonUser@$JetsonHost"

Test-JetsonConnection
Build-Application
Deploy-ToJetson

Write-Log "Windows preparation completed!" "SUCCESS"
Write-Log ""
Write-Log "Next steps:" "SUCCESS"
Write-Log "1. Use one of the deployment options shown above" "SUCCESS"
Write-Log "2. Monitor deployment: ssh $JetsonUser@$JetsonHost 'docker logs -f jetson-home-assistant-jp5'" "SUCCESS"
Write-Log "3. Access your Home Assistant at: http://$JetsonHost:8080" "SUCCESS"