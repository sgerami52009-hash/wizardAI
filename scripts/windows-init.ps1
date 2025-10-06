# Voice Interaction Pipeline - Windows Development Initialization Script
# This script sets up the voice pipeline system on Windows for development

param(
    [switch]$SkipDependencies,
    [switch]$Force,
    [string]$Environment = "development"
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$ModelsDir = Join-Path $ProjectRoot "models"
$ConfigDir = Join-Path $ProjectRoot "config"
$LogFile = Join-Path $ProjectRoot "logs\voice-pipeline-init.log"

# Ensure logs directory exists
$LogsDir = Join-Path $ProjectRoot "logs"
if (-not (Test-Path $LogsDir)) {
    New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
}

# Logging functions
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] [$Level] $Message"
    
    switch ($Level) {
        "ERROR" { Write-Host $LogMessage -ForegroundColor Red }
        "WARNING" { Write-Host $LogMessage -ForegroundColor Yellow }
        "SUCCESS" { Write-Host $LogMessage -ForegroundColor Green }
        default { Write-Host $LogMessage -ForegroundColor White }
    }
    
    Add-Content -Path $LogFile -Value $LogMessage
}

function Write-LogError {
    param([string]$Message)
    Write-Log -Message $Message -Level "ERROR"
}

function Write-LogSuccess {
    param([string]$Message)
    Write-Log -Message $Message -Level "SUCCESS"
}

function Write-LogWarning {
    param([string]$Message)
    Write-Log -Message $Message -Level "WARNING"
}

# Check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check system requirements
function Test-SystemRequirements {
    Write-Log "Checking system requirements..."
    
    # Check Windows version
    $osVersion = [System.Environment]::OSVersion.Version
    if ($osVersion.Major -lt 10) {
        Write-LogError "Windows 10 or later is required"
        exit 1
    }
    Write-LogSuccess "Windows version check passed"
    
    # Check available memory
    $totalMemory = (Get-CimInstance -ClassName Win32_ComputerSystem).TotalPhysicalMemory / 1GB
    if ($totalMemory -lt 8) {
        Write-LogWarning "Less than 8GB RAM detected: $([math]::Round($totalMemory, 1))GB"
        Write-LogWarning "Voice pipeline may experience performance issues"
    } else {
        Write-LogSuccess "Memory check passed: $([math]::Round($totalMemory, 1))GB available"
    }
    
    # Check available disk space
    $freeSpace = (Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'").FreeSpace / 1GB
    if ($freeSpace -lt 10) {
        Write-LogError "Insufficient disk space: $([math]::Round($freeSpace, 1))GB free"
        Write-LogError "At least 10GB free space is required"
        exit 1
    }
    Write-LogSuccess "Disk space check passed: $([math]::Round($freeSpace, 1))GB free"
}

# Install Chocolatey if not present
function Install-Chocolatey {
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Log "Installing Chocolatey package manager..."
        
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        
        try {
            Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
            Write-LogSuccess "Chocolatey installed successfully"
        } catch {
            Write-LogError "Failed to install Chocolatey: $($_.Exception.Message)"
            exit 1
        }
    } else {
        Write-LogSuccess "Chocolatey already installed"
    }
}

# Install system dependencies
function Install-Dependencies {
    if ($SkipDependencies) {
        Write-LogWarning "Skipping dependency installation"
        return
    }
    
    Write-Log "Installing system dependencies..."
    
    # Install Node.js
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Log "Installing Node.js..."
        choco install nodejs -y
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "Failed to install Node.js"
            exit 1
        }
    } else {
        $nodeVersion = node --version
        Write-LogSuccess "Node.js already installed: $nodeVersion"
    }
    
    # Install Python
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        Write-Log "Installing Python..."
        choco install python -y
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "Failed to install Python"
            exit 1
        }
    } else {
        $pythonVersion = python --version
        Write-LogSuccess "Python already installed: $pythonVersion"
    }
    
    # Install Git
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Log "Installing Git..."
        choco install git -y
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "Failed to install Git"
            exit 1
        }
    } else {
        $gitVersion = git --version
        Write-LogSuccess "Git already installed: $gitVersion"
    }
    
    # Install FFmpeg for audio processing
    if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
        Write-Log "Installing FFmpeg..."
        choco install ffmpeg -y
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "Failed to install FFmpeg"
            exit 1
        }
    } else {
        Write-LogSuccess "FFmpeg already installed"
    }
    
    Write-LogSuccess "System dependencies installed"
}

# Create necessary directories
function New-ProjectDirectories {
    Write-Log "Creating project directories..."
    
    $directories = @(
        $ModelsDir,
        $ConfigDir,
        (Join-Path $ProjectRoot "logs"),
        (Join-Path $ProjectRoot "temp"),
        (Join-Path $ProjectRoot "cache"),
        (Join-Path $ProjectRoot "test-models"),
        (Join-Path $ProjectRoot "test-templates")
    )
    
    foreach ($dir in $directories) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Log "Created directory: $dir"
        }
    }
    
    Write-LogSuccess "Project directories created"
}

# Install Node.js dependencies
function Install-NodeDependencies {
    Write-Log "Installing Node.js dependencies..."
    
    Set-Location $ProjectRoot
    
    # Install npm dependencies
    if (Test-Path "package.json") {
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "Failed to install npm dependencies"
            exit 1
        }
    } else {
        Write-LogWarning "package.json not found, skipping npm install"
    }
    
    # Install additional Windows-specific audio libraries
    Write-Log "Installing Windows audio libraries..."
    npm install --save-optional `
        node-record-lpcm16 `
        speaker `
        wav `
        node-opus `
        @tensorflow/tfjs-node
    
    Write-LogSuccess "Node.js dependencies installed"
}

# Download development models
function Get-DevelopmentModels {
    Write-Log "Setting up development models..."
    
    Set-Location $ModelsDir
    
    # Create placeholder model files for development
    $models = @(
        "wake-word-dev.onnx",
        "whisper-base-dev.onnx",
        "intent-classifier-dev.onnx",
        "tts-dev.onnx",
        "wake-word-dev-lite.onnx",
        "whisper-tiny-dev.onnx",
        "intent-dev-lite.onnx",
        "tts-dev-lite.onnx"
    )
    
    foreach ($model in $models) {
        if (-not (Test-Path $model)) {
            # Create a small placeholder file
            "# Placeholder model file for development" | Out-File -FilePath $model -Encoding UTF8
            Write-Log "Created placeholder model: $model"
        }
    }
    
    # Create test models directory
    $testModelsDir = Join-Path $ProjectRoot "test-models"
    Set-Location $testModelsDir
    
    $testModels = @(
        "wake-word-test.onnx",
        "whisper-test.onnx",
        "intent-test.onnx",
        "tts-test.onnx",
        "wake-word-mock.onnx",
        "whisper-mock.onnx",
        "intent-mock.onnx",
        "tts-mock.onnx"
    )
    
    foreach ($model in $testModels) {
        if (-not (Test-Path $model)) {
            "# Test model placeholder" | Out-File -FilePath $model -Encoding UTF8
            Write-Log "Created test model: $model"
        }
    }
    
    Write-LogSuccess "Development models set up"
}

# Setup audio system for Windows
function Initialize-AudioSystem {
    Write-Log "Initializing Windows audio system..."
    
    # Check for audio devices
    try {
        $audioDevices = Get-CimInstance -ClassName Win32_SoundDevice
        if ($audioDevices.Count -eq 0) {
            Write-LogWarning "No audio devices detected"
        } else {
            Write-LogSuccess "Audio devices detected: $($audioDevices.Count)"
            foreach ($device in $audioDevices) {
                Write-Log "  - $($device.Name)"
            }
        }
    } catch {
        Write-LogWarning "Could not enumerate audio devices: $($_.Exception.Message)"
    }
    
    # Test Windows Audio Service
    $audioService = Get-Service -Name "AudioSrv" -ErrorAction SilentlyContinue
    if ($audioService -and $audioService.Status -eq "Running") {
        Write-LogSuccess "Windows Audio Service is running"
    } else {
        Write-LogWarning "Windows Audio Service is not running"
    }
    
    Write-LogSuccess "Audio system initialization completed"
}

# Create Windows service (optional)
function New-WindowsService {
    param([switch]$Install)
    
    if (-not $Install) {
        Write-Log "Skipping Windows service creation (use -Install to create)"
        return
    }
    
    Write-Log "Creating Windows service..."
    
    # Create service wrapper script
    $serviceScript = Join-Path $ProjectRoot "scripts\voice-pipeline-service.ps1"
    
    @"
# Voice Pipeline Windows Service Wrapper
Set-Location "$ProjectRoot"
node dist/index.js
"@ | Out-File -FilePath $serviceScript -Encoding UTF8
    
    Write-LogSuccess "Service script created at: $serviceScript"
    Write-Log "To install as Windows service, use a tool like NSSM (Non-Sucking Service Manager)"
    Write-Log "Example: nssm install VoicePipeline powershell.exe -ExecutionPolicy Bypass -File `"$serviceScript`""
}

# Setup development environment
function Initialize-DevelopmentEnvironment {
    Write-Log "Setting up development environment..."
    
    # Create VS Code settings if not exists
    $vscodeDir = Join-Path $ProjectRoot ".vscode"
    if (-not (Test-Path $vscodeDir)) {
        New-Item -ItemType Directory -Path $vscodeDir -Force | Out-Null
    }
    
    $settingsFile = Join-Path $vscodeDir "settings.json"
    if (-not (Test-Path $settingsFile)) {
        @"
{
    "typescript.preferences.includePackageJsonAutoImports": "on",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
        "source.fixAll.eslint": true
    },
    "files.exclude": {
        "**/node_modules": true,
        "**/dist": true,
        "**/.git": true
    },
    "search.exclude": {
        "**/node_modules": true,
        "**/dist": true
    }
}
"@ | Out-File -FilePath $settingsFile -Encoding UTF8
        Write-Log "Created VS Code settings"
    }
    
    # Create launch configuration
    $launchFile = Join-Path $vscodeDir "launch.json"
    if (-not (Test-Path $launchFile)) {
        @"
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Launch Voice Pipeline",
            "type": "node",
            "request": "launch",
            "program": "`${workspaceFolder}/dist/index.js",
            "env": {
                "NODE_ENV": "development"
            },
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen"
        },
        {
            "name": "Run Tests",
            "type": "node",
            "request": "launch",
            "program": "`${workspaceFolder}/node_modules/.bin/jest",
            "args": ["--runInBand"],
            "console": "integratedTerminal",
            "internalConsoleOptions": "neverOpen"
        }
    ]
}
"@ | Out-File -FilePath $launchFile -Encoding UTF8
        Write-Log "Created VS Code launch configuration"
    }
    
    Write-LogSuccess "Development environment configured"
}

# Build the project
function Build-Project {
    Write-Log "Building voice pipeline project..."
    
    Set-Location $ProjectRoot
    
    # Check if TypeScript is available
    if (-not (Get-Command tsc -ErrorAction SilentlyContinue)) {
        Write-Log "Installing TypeScript globally..."
        npm install -g typescript
    }
    
    # Build the project
    if (Test-Path "tsconfig.json") {
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-LogError "Build failed"
            exit 1
        }
        
        # Verify build output
        if (Test-Path "dist\index.js") {
            Write-LogSuccess "Project built successfully"
        } else {
            Write-LogError "Build completed but dist\index.js not found"
            exit 1
        }
    } else {
        Write-LogWarning "tsconfig.json not found, skipping build"
    }
}

# Create startup scripts
function New-StartupScripts {
    Write-Log "Creating startup scripts..."
    
    # Create start script
    $startScript = Join-Path $ProjectRoot "start.ps1"
    @"
# Voice Pipeline Startup Script
param([string]`$Environment = "development")

`$ProjectRoot = Split-Path -Parent `$MyInvocation.MyCommand.Path
Set-Location `$ProjectRoot

Write-Host "Starting Voice Interaction Pipeline..." -ForegroundColor Green
Write-Host "Environment: `$Environment" -ForegroundColor Yellow

`$env:NODE_ENV = `$Environment
node dist/index.js
"@ | Out-File -FilePath $startScript -Encoding UTF8
    
    # Create stop script
    $stopScript = Join-Path $ProjectRoot "stop.ps1"
    @"
# Voice Pipeline Stop Script
Write-Host "Stopping Voice Interaction Pipeline..." -ForegroundColor Yellow

Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    `$_.MainModule.FileName -like "*voice*" -or `$_.CommandLine -like "*voice*"
} | Stop-Process -Force

Write-Host "Voice Pipeline stopped" -ForegroundColor Green
"@ | Out-File -FilePath $stopScript -Encoding UTF8
    
    Write-LogSuccess "Startup scripts created"
}

# Main installation function
function Start-Installation {
    Write-Log "Starting Voice Interaction Pipeline installation on Windows..."
    Write-Log "Environment: $Environment"
    
    if (-not (Test-Administrator)) {
        Write-LogWarning "Not running as administrator. Some features may not work correctly."
    }
    
    Test-SystemRequirements
    Install-Chocolatey
    Install-Dependencies
    New-ProjectDirectories
    Install-NodeDependencies
    Get-DevelopmentModels
    Initialize-AudioSystem
    Initialize-DevelopmentEnvironment
    Build-Project
    New-StartupScripts
    New-WindowsService
    
    Write-LogSuccess "Installation completed successfully!"
    Write-Log ""
    Write-Log "Next steps:"
    Write-Log "1. Open the project in VS Code: code ."
    Write-Log "2. Start the development server: .\start.ps1"
    Write-Log "3. Run tests: npm test"
    Write-Log "4. View logs in: logs\voice-pipeline.log"
    Write-Log ""
    Write-Log "Configuration files are in: $ConfigDir"
    Write-Log "Development models are in: $ModelsDir"
}

# Run installation
try {
    Start-Installation
} catch {
    Write-LogError "Installation failed: $($_.Exception.Message)"
    Write-LogError "Stack trace: $($_.ScriptStackTrace)"
    exit 1
}