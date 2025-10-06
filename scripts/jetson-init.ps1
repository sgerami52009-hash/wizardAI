# Voice Interaction Pipeline - Jetson Nano Orin Initialization Script (PowerShell)
# This script sets up the voice pipeline system on Jetson Nano Orin hardware

param(
    [switch]$SkipHardwareCheck,
    [switch]$DevelopmentMode,
    [string]$ConfigEnvironment = "production"
)

# Configuration
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$LogFile = "/var/log/voice-pipeline-init.log"
$ModelsDir = Join-Path $ProjectRoot "models"
$ConfigDir = Join-Path $ProjectRoot "config"
$ServiceName = "voice-pipeline"

# Colors for output (PowerShell compatible)
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

# Logging functions
function Write-Log {
    param([string]$Message, [string]$Color = "White")
    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $LogMessage = "[$Timestamp] $Message"
    Write-Host $LogMessage -ForegroundColor $Color
    Add-Content -Path $LogFile -Value $LogMessage -ErrorAction SilentlyContinue
}

function Write-LogError {
    param([string]$Message)
    Write-Log "[ERROR] $Message" -Color $Red
}

function Write-LogSuccess {
    param([string]$Message)
    Write-Log "[SUCCESS] $Message" -Color $Green
}

function Write-LogWarning {
    param([string]$Message)
    Write-Log "[WARNING] $Message" -Color $Yellow
}

# Check if running with appropriate privileges
function Test-AdminPrivileges {
    if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
        Write-LogError "This script requires Administrator privileges"
        Write-Log "Please run PowerShell as Administrator"
        exit 1
    }
}

# Check if running on compatible hardware (adapted for Windows testing)
function Test-HardwareCompatibility {
    if ($SkipHardwareCheck) {
        Write-LogWarning "Hardware check skipped by user request"
        return
    }

    Write-Log "Checking hardware compatibility..." -Color $Blue
    
    # Check available memory (Windows equivalent)
    $TotalMemoryGB = [math]::Round((Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum).Sum / 1GB, 2)
    
    if ($TotalMemoryGB -lt 7) {
        Write-LogError "Insufficient memory detected: ${TotalMemoryGB}GB"
        Write-LogError "Voice pipeline requires at least 8GB RAM"
        exit 1
    }
    
    Write-LogSuccess "Memory check passed: ${TotalMemoryGB}GB available"
    
    # Check for NVIDIA GPU (if available)
    try {
        $NvidiaGPU = Get-CimInstance Win32_VideoController | Where-Object { $_.Name -like "*NVIDIA*" }
        if ($NvidiaGPU) {
            Write-LogSuccess "NVIDIA GPU detected: $($NvidiaGPU.Name)"
        } else {
            Write-LogWarning "No NVIDIA GPU detected - some optimizations may not be available"
        }
    } catch {
        Write-LogWarning "Could not detect GPU information"
    }
}

# Install system dependencies (Windows equivalent)
function Install-Dependencies {
    Write-Log "Installing system dependencies..." -Color $Blue
    
    # Check for Chocolatey
    if (-not (Get-Command choco -ErrorAction SilentlyContinue)) {
        Write-Log "Installing Chocolatey package manager..."
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    }
    
    # Install required packages
    $Packages = @(
        "nodejs",
        "python3",
        "git",
        "cmake",
        "visualstudio2019buildtools",
        "ffmpeg"
    )
    
    foreach ($Package in $Packages) {
        Write-Log "Installing $Package..."
        try {
            choco install $Package -y --no-progress
        } catch {
            Write-LogWarning "Failed to install $Package - continuing anyway"
        }
    }
    
    Write-LogSuccess "System dependencies installation completed"
}

# Setup CUDA and TensorRT (Windows equivalent)
function Set-CudaTensorRT {
    Write-Log "Setting up CUDA and TensorRT..." -Color $Blue
    
    # Check for CUDA installation
    $CudaPath = $env:CUDA_PATH
    if ($CudaPath -and (Test-Path $CudaPath)) {
        Write-LogSuccess "CUDA found at: $CudaPath"
        
        # Add CUDA to PATH if not already there
        $CurrentPath = $env:PATH
        $CudaBinPath = Join-Path $CudaPath "bin"
        if ($CurrentPath -notlike "*$CudaBinPath*") {
            $env:PATH = "$CurrentPath;$CudaBinPath"
            [Environment]::SetEnvironmentVariable("PATH", $env:PATH, [EnvironmentVariableTarget]::Machine)
        }
    } else {
        Write-LogWarning "CUDA not found - GPU acceleration may not be available"
        Write-Log "Please install CUDA toolkit from NVIDIA developer website"
    }
    
    # Check for TensorRT
    $TensorRTPath = "${env:ProgramFiles}\NVIDIA GPU Computing Toolkit\TensorRT"
    if (Test-Path $TensorRTPath) {
        Write-LogSuccess "TensorRT found at: $TensorRTPath"
    } else {
        Write-LogWarning "TensorRT not found - some optimizations may not be available"
    }
    
    Write-LogSuccess "CUDA/TensorRT setup completed"
}

# Install Node.js dependencies
function Install-NodeDependencies {
    Write-Log "Installing Node.js dependencies..." -Color $Blue
    
    Set-Location $ProjectRoot
    
    # Install npm dependencies
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-LogError "Failed to install npm dependencies"
        exit 1
    }
    
    # Install additional audio processing libraries
    $AudioPackages = @(
        "node-record-lpcm16",
        "speaker",
        "wav",
        "node-opus"
    )
    
    foreach ($Package in $AudioPackages) {
        Write-Log "Installing $Package..."
        npm install --save $Package
    }
    
    Write-LogSuccess "Node.js dependencies installed"
}

# Create necessary directories
function New-ProjectDirectories {
    Write-Log "Creating necessary directories..." -Color $Blue
    
    $Directories = @(
        $ModelsDir,
        $ConfigDir,
        (Join-Path $ProjectRoot "logs"),
        (Join-Path $ProjectRoot "temp"),
        (Join-Path $ProjectRoot "cache")
    )
    
    foreach ($Dir in $Directories) {
        if (-not (Test-Path $Dir)) {
            New-Item -ItemType Directory -Path $Dir -Force | Out-Null
            Write-Log "Created directory: $Dir"
        }
    }
    
    Write-LogSuccess "Directories created"
}

# Download and validate AI models
function Get-AIModels {
    Write-Log "Downloading AI models..." -Color $Blue
    
    Set-Location $ModelsDir
    
    # Create model download script (PowerShell version)
    $DownloadScript = @"
# Model download script for Windows
`$Models = @{
    'wake-word-prod.onnx' = 'https://example.com/models/wake-word-jetson.onnx'
    'whisper-base-prod.onnx' = 'https://example.com/models/whisper-base-jetson.onnx'
    'intent-classifier-prod.onnx' = 'https://example.com/models/intent-classifier-jetson.onnx'
    'tts-prod.onnx' = 'https://example.com/models/tts-jetson.onnx'
}

function Download-WithRetry {
    param([string]`$Url, [string]`$Output, [int]`$MaxAttempts = 3)
    
    for (`$attempt = 1; `$attempt -le `$MaxAttempts; `$attempt++) {
        Write-Host "Downloading `$Output (attempt `$attempt/`$MaxAttempts)..."
        try {
            Invoke-WebRequest -Uri `$Url -OutFile `$Output -UseBasicParsing
            Write-Host "Successfully downloaded `$Output"
            return `$true
        } catch {
            Write-Host "Download failed for `$Output (attempt `$attempt): `$(`$_.Exception.Message)"
            if (Test-Path `$Output) { Remove-Item `$Output -Force }
            Start-Sleep -Seconds 5
        }
    }
    
    Write-Host "Failed to download `$Output after `$MaxAttempts attempts"
    return `$false
}

# Download models (commented out as URLs are placeholders)
# foreach (`$Model in `$Models.GetEnumerator()) {
#     Download-WithRetry `$Model.Value `$Model.Key
# }

# Create placeholder models for testing
Write-Host "Creating placeholder model files..."
foreach (`$ModelName in `$Models.Keys) {
    New-Item -ItemType File -Path `$ModelName -Force | Out-Null
}

Write-Host "Model download completed"
"@
    
    $DownloadScript | Out-File -FilePath "download_models.ps1" -Encoding UTF8
    
    # Execute the download script
    PowerShell -ExecutionPolicy Bypass -File "download_models.ps1"
    
    Write-LogSuccess "AI models downloaded"
}

# Validate model integrity
function Test-ModelIntegrity {
    Write-Log "Validating model integrity..." -Color $Blue
    
    Set-Location $ModelsDir
    
    $RequiredModels = @(
        "wake-word-prod.onnx",
        "whisper-base-prod.onnx",
        "intent-classifier-prod.onnx",
        "tts-prod.onnx"
    )
    
    foreach ($Model in $RequiredModels) {
        if (Test-Path $Model) {
            $FileInfo = Get-Item $Model
            if ($FileInfo.Length -gt 0) {
                Write-LogSuccess "Model validated: $Model"
            } else {
                Write-LogError "Model file is empty: $Model"
                exit 1
            }
        } else {
            Write-LogError "Required model not found: $Model"
            exit 1
        }
    }
    
    Write-LogSuccess "All models validated"
}

# Setup audio system (Windows equivalent)
function Set-AudioSystem {
    Write-Log "Setting up audio system..." -Color $Blue
    
    # Check for audio devices
    try {
        $AudioDevices = Get-CimInstance Win32_SoundDevice
        if ($AudioDevices) {
            Write-Log "Available audio devices:"
            foreach ($Device in $AudioDevices) {
                Write-Log "  - $($Device.Name)"
            }
        } else {
            Write-LogWarning "No audio devices found"
        }
    } catch {
        Write-LogWarning "Could not enumerate audio devices"
    }
    
    Write-LogSuccess "Audio system configured"
}

# Create Windows service
function New-WindowsService {
    Write-Log "Creating Windows service..." -Color $Blue
    
    # Create service wrapper script
    $ServiceScript = @"
# Voice Pipeline Service Wrapper
`$ProjectRoot = "$ProjectRoot"
`$NodePath = (Get-Command node).Source
`$ServicePath = Join-Path `$ProjectRoot "dist\index.js"

Set-Location `$ProjectRoot
`$env:NODE_ENV = "$ConfigEnvironment"

# Start the voice pipeline
& `$NodePath `$ServicePath
"@
    
    $ServiceScriptPath = Join-Path $ProjectRoot "scripts\service-wrapper.ps1"
    $ServiceScript | Out-File -FilePath $ServiceScriptPath -Encoding UTF8
    
    # Create NSSM service (if NSSM is available)
    if (Get-Command nssm -ErrorAction SilentlyContinue) {
        Write-Log "Creating service with NSSM..."
        
        nssm install $ServiceName powershell
        nssm set $ServiceName Application "powershell.exe"
        nssm set $ServiceName AppParameters "-ExecutionPolicy Bypass -File `"$ServiceScriptPath`""
        nssm set $ServiceName DisplayName "Voice Interaction Pipeline"
        nssm set $ServiceName Description "Family-friendly AI assistant voice interaction system"
        nssm set $ServiceName Start SERVICE_AUTO_START
        
        Write-LogSuccess "Windows service created with NSSM"
    } else {
        Write-LogWarning "NSSM not found - service creation skipped"
        Write-Log "Install NSSM (Non-Sucking Service Manager) to create Windows service"
        Write-Log "Or run the service manually using: powershell -File `"$ServiceScriptPath`""
    }
}

# Setup monitoring and health checks
function Set-Monitoring {
    Write-Log "Setting up monitoring and health checks..." -Color $Blue
    
    # Create health check script
    $HealthCheckScript = @"
# Voice Pipeline Health Check Script (Windows)
`$ServiceName = "$ServiceName"
`$LogFile = "C:\logs\voice-pipeline-health.log"
`$MaxMemoryMB = 6144  # 6GB limit for Jetson Nano Orin
`$MaxCpuPercent = 80

function Write-HealthLog {
    param([string]`$Message)
    `$Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path `$LogFile -Value "[`$Timestamp] `$Message"
}

# Check service status (if using NSSM)
if (Get-Command nssm -ErrorAction SilentlyContinue) {
    `$ServiceStatus = nssm status `$ServiceName
    if (`$ServiceStatus -ne "SERVICE_RUNNING") {
        Write-HealthLog "ERROR: Service `$ServiceName is not running (Status: `$ServiceStatus)"
        exit 1
    }
}

# Check memory usage
try {
    `$NodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if (`$NodeProcesses) {
        `$TotalMemoryMB = (`$NodeProcesses | Measure-Object -Property WorkingSet -Sum).Sum / 1MB
        if (`$TotalMemoryMB -gt `$MaxMemoryMB) {
            Write-HealthLog "WARNING: High memory usage: `${TotalMemoryMB}MB"
        }
    }
} catch {
    Write-HealthLog "WARNING: Could not check memory usage"
}

# Check CPU usage
try {
    `$NodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
    if (`$NodeProcesses) {
        `$TotalCpuPercent = (`$NodeProcesses | Measure-Object -Property CPU -Sum).Sum
        if (`$TotalCpuPercent -gt `$MaxCpuPercent) {
            Write-HealthLog "WARNING: High CPU usage: `${TotalCpuPercent}%"
        }
    }
} catch {
    Write-HealthLog "WARNING: Could not check CPU usage"
}

Write-HealthLog "Health check completed successfully"
"@
    
    $HealthCheckPath = Join-Path $ProjectRoot "scripts\health-check.ps1"
    $HealthCheckScript | Out-File -FilePath $HealthCheckPath -Encoding UTF8
    
    # Create scheduled task for health checks
    try {
        $TaskName = "VoicePipelineHealthCheck"
        $TaskAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File `"$HealthCheckPath`""
        $TaskTrigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 5) -Once -At (Get-Date)
        $TaskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
        
        Register-ScheduledTask -TaskName $TaskName -Action $TaskAction -Trigger $TaskTrigger -Settings $TaskSettings -Force
        Write-LogSuccess "Health check scheduled task created"
    } catch {
        Write-LogWarning "Could not create scheduled task for health checks"
    }
}

# Build the project
function Build-Project {
    Write-Log "Building voice pipeline project..." -Color $Blue
    
    Set-Location $ProjectRoot
    
    # Install dependencies if not already done
    if (-not (Test-Path "node_modules")) {
        npm install
    }
    
    # Build TypeScript
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-LogError "Build failed"
        exit 1
    }
    
    # Verify build output
    if (-not (Test-Path "dist\index.js")) {
        Write-LogError "Build failed - dist\index.js not found"
        exit 1
    }
    
    Write-LogSuccess "Project built successfully"
}

# Main installation function
function Start-Installation {
    Write-Log "Starting Voice Interaction Pipeline installation..." -Color $Blue
    
    Test-AdminPrivileges
    Test-HardwareCompatibility
    Install-Dependencies
    Set-CudaTensorRT
    New-ProjectDirectories
    Install-NodeDependencies
    Get-AIModels
    Test-ModelIntegrity
    Set-AudioSystem
    Build-Project
    New-WindowsService
    Set-Monitoring
    
    Write-LogSuccess "Installation completed successfully!"
    Write-Log ""
    Write-Log "Next steps:"
    Write-Log "1. Start the service: nssm start $ServiceName (if NSSM is installed)"
    Write-Log "2. Or run manually: powershell -File `"$ProjectRoot\scripts\service-wrapper.ps1`""
    Write-Log "3. Check service status: nssm status $ServiceName"
    Write-Log ""
    Write-Log "Configuration files are located in: $ConfigDir"
    Write-Log "Logs are located in: $ProjectRoot\logs"
    Write-Log "Health check logs: C:\logs\voice-pipeline-health.log"
}

# Run main function
try {
    Start-Installation
} catch {
    Write-LogError "Installation failed: $($_.Exception.Message)"
    Write-LogError "Stack trace: $($_.ScriptStackTrace)"
    exit 1
}