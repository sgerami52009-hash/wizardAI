#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Docker and JetPack 6 Compatibility Validation Script
    
.DESCRIPTION
    Validates Docker version and JetPack 6 compatibility for Home Assistant deployment
    
.PARAMETER Verbose
    Enable verbose output
    
.EXAMPLE
    .\scripts\validate-docker-jetpack6.ps1
    
.EXAMPLE
    .\scripts\validate-docker-jetpack6.ps1 -Verbose
#>

param(
    [switch]$Verbose
)

$ErrorActionPreference = "Continue"

if ($Verbose) {
    $VerbosePreference = "Continue"
}

# Configuration
$ScriptName = "Docker JetPack 6 Compatibility Validator"
$MinDockerVersion = "20.10.0"
$RecommendedDockerVersion = "24.0.0"
$MinComposeVersion = "2.0.0"
$RecommendedComposeVersion = "2.20.0"

Write-Host "🐳 $ScriptName" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "Validating Docker compatibility with JetPack 6.0+" -ForegroundColor Gray
Write-Host ""

# Function to write colored output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Function to compare versions
function Compare-Version {
    param(
        [string]$Version1,
        [string]$Version2
    )
    
    $v1 = [System.Version]::Parse($Version1)
    $v2 = [System.Version]::Parse($Version2)
    
    return $v1.CompareTo($v2)
}

# Check if running on Jetson (simulated for Windows)
function Test-JetsonPlatform {
    Write-ColorOutput "🔍 Checking Jetson platform..." "Yellow"
    
    # On Windows, we simulate Jetson detection
    if ($env:JETSON_PLATFORM -eq "orin-nano" -or $env:JETSON_VIRTUAL -eq "true") {
        Write-ColorOutput "  ✅ Jetson platform detected (simulated)" "Green"
        
        if ($env:JETPACK_VERSION -and $env:JETPACK_VERSION.StartsWith("6")) {
            Write-ColorOutput "  ✅ JetPack 6.x detected" "Green"
            return $true
        } else {
            Write-ColorOutput "  ⚠️  JetPack version not 6.x or not set" "Yellow"
            return $false
        }
    } else {
        Write-ColorOutput "  ⚠️  Not running on Jetson platform (or simulation not enabled)" "Yellow"
        Write-ColorOutput "     Set JETSON_PLATFORM=orin-nano and JETPACK_VERSION=6.0 to simulate" "Gray"
        return $false
    }
}

# Check Docker installation
function Test-Docker {
    Write-ColorOutput "🐳 Checking Docker installation..." "Yellow"
    
    try {
        $dockerVersion = docker --version 2>$null
        if ($dockerVersion) {
            $versionMatch = $dockerVersion | Select-String -Pattern '(\d+\.\d+\.\d+)'
            if ($versionMatch) {
                $version = $versionMatch.Matches[0].Groups[1].Value
                Write-ColorOutput "  ✅ Docker installed: $version" "Green"
                
                # Check minimum version
                $comparison = Compare-Version $version $MinDockerVersion
                if ($comparison -ge 0) {
                    Write-ColorOutput "  ✅ Docker version meets minimum requirement ($MinDockerVersion)" "Green"
                } else {
                    Write-ColorOutput "  ❌ Docker version too old. Minimum required: $MinDockerVersion" "Red"
                    Write-ColorOutput "     Please upgrade Docker for JetPack 6 compatibility" "Yellow"
                    return $false
                }
                
                # Check recommended version
                $comparison = Compare-Version $version $RecommendedDockerVersion
                if ($comparison -ge 0) {
                    Write-ColorOutput "  ✅ Docker version meets recommended requirement ($RecommendedDockerVersion)" "Green"
                } else {
                    Write-ColorOutput "  ⚠️  Docker version below recommended ($RecommendedDockerVersion)" "Yellow"
                    Write-ColorOutput "     Consider upgrading for optimal JetPack 6 performance" "Yellow"
                }
                
                return $true
            }
        }
    } catch {
        Write-ColorOutput "  ❌ Docker not installed or not accessible" "Red"
        Write-ColorOutput "     Install Docker Desktop from https://docker.com/products/docker-desktop" "Yellow"
        return $false
    }
    
    Write-ColorOutput "  ❌ Could not determine Docker version" "Red"
    return $false
}

# Check Docker Compose
function Test-DockerCompose {
    Write-ColorOutput "📦 Checking Docker Compose..." "Yellow"
    
    try {
        # Check for Docker Compose V2 (preferred)
        $composeVersion = docker compose version 2>$null
        if ($composeVersion) {
            $versionMatch = $composeVersion | Select-String -Pattern '(\d+\.\d+\.\d+)'
            if ($versionMatch) {
                $version = $versionMatch.Matches[0].Groups[1].Value
                Write-ColorOutput "  ✅ Docker Compose V2 installed: $version" "Green"
                $script:ComposeV2 = $true
            }
        } else {
            # Check for Docker Compose V1 (legacy)
            $composeVersion = docker-compose --version 2>$null
            if ($composeVersion) {
                $versionMatch = $composeVersion | Select-String -Pattern '(\d+\.\d+\.\d+)'
                if ($versionMatch) {
                    $version = $versionMatch.Matches[0].Groups[1].Value
                    Write-ColorOutput "  ⚠️  Docker Compose V1 installed: $version" "Yellow"
                    Write-ColorOutput "     Consider upgrading to Docker Compose V2 for better JetPack 6 support" "Yellow"
                    $script:ComposeV2 = $false
                }
            }
        }
        
        if ($version) {
            # Check version compatibility
            $comparison = Compare-Version $version $MinComposeVersion
            if ($comparison -ge 0) {
                Write-ColorOutput "  ✅ Docker Compose version meets minimum requirement ($MinComposeVersion)" "Green"
                return $true
            } else {
                Write-ColorOutput "  ❌ Docker Compose version too old. Minimum required: $MinComposeVersion" "Red"
                return $false
            }
        }
    } catch {
        Write-ColorOutput "  ❌ Docker Compose not installed" "Red"
        Write-ColorOutput "     Docker Compose is included with Docker Desktop" "Yellow"
        return $false
    }
    
    return $false
}

# Check system resources
function Test-SystemResources {
    Write-ColorOutput "💾 Checking system resources..." "Yellow"
    
    # Memory check
    try {
        $totalMemoryGB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
        if ($totalMemoryGB -ge 8) {
            Write-ColorOutput "  ✅ Memory: ${totalMemoryGB}GB (sufficient for JetPack 6)" "Green"
        } else {
            Write-ColorOutput "  ⚠️  Memory: ${totalMemoryGB}GB (may be limited for full JetPack 6 features)" "Yellow"
        }
    } catch {
        Write-ColorOutput "  ⚠️  Could not determine memory size" "Yellow"
    }
    
    # Disk space check
    try {
        $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='C:'"
        $freeSpaceGB = [math]::Round($disk.FreeSpace / 1GB, 1)
        if ($freeSpaceGB -ge 20) {
            Write-ColorOutput "  ✅ Disk space: ${freeSpaceGB}GB available" "Green"
        } else {
            Write-ColorOutput "  ⚠️  Disk space: ${freeSpaceGB}GB available (may need cleanup)" "Yellow"
        }
    } catch {
        Write-ColorOutput "  ⚠️  Could not determine disk space" "Yellow"
    }
    
    # CPU cores
    try {
        $cpuCores = (Get-CimInstance Win32_ComputerSystem).NumberOfProcessors
        Write-ColorOutput "  ✅ CPU cores: $cpuCores" "Green"
    } catch {
        Write-ColorOutput "  ⚠️  Could not determine CPU core count" "Yellow"
    }
}

# Test Docker functionality
function Test-DockerFunctionality {
    Write-ColorOutput "🧪 Testing Docker functionality..." "Yellow"
    
    try {
        # Test basic Docker run
        $result = docker run --rm hello-world 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "  ✅ Docker basic functionality working" "Green"
        } else {
            Write-ColorOutput "  ❌ Docker basic functionality failed" "Red"
            return $false
        }
    } catch {
        Write-ColorOutput "  ❌ Docker basic functionality test failed" "Red"
        return $false
    }
    
    # Test Docker Compose (if available)
    if ($script:ComposeV2) {
        try {
            docker compose version >$null 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput "  ✅ Docker Compose V2 functionality working" "Green"
            } else {
                Write-ColorOutput "  ❌ Docker Compose V2 functionality failed" "Red"
            }
        } catch {
            Write-ColorOutput "  ⚠️  Could not test Docker Compose functionality" "Yellow"
        }
    }
    
    return $true
}

# Generate compatibility report
function Write-CompatibilityReport {
    param(
        [bool]$JetPack6,
        [string]$DockerVersion,
        [string]$ComposeVersion
    )
    
    Write-ColorOutput "📋 JetPack 6 Docker Compatibility Report" "Cyan"
    Write-ColorOutput "=======================================" "Cyan"
    
    if ($JetPack6) {
        Write-ColorOutput "✅ Platform: JetPack 6.x compatible" "Green"
    } else {
        Write-ColorOutput "⚠️  Platform: Not JetPack 6 or compatibility unknown" "Yellow"
    }
    
    Write-Host "Docker Version: $DockerVersion"
    Write-Host "Docker Compose: $ComposeVersion"
    
    if ($JetPack6 -and (Compare-Version $DockerVersion $RecommendedDockerVersion) -ge 0) {
        Write-ColorOutput "✅ Recommended configuration for JetPack 6 deployment" "Green"
        Write-Host ""
        Write-ColorOutput "🚀 Ready to deploy with:" "Green"
        Write-Host "   docker compose -f deployment/docker-compose.jetpack6.yml up -d"
    } else {
        Write-ColorOutput "⚠️  Some optimizations recommended for JetPack 6" "Yellow"
        Write-Host ""
        Write-ColorOutput "📝 Recommendations:" "Yellow"
        if ((Compare-Version $DockerVersion $RecommendedDockerVersion) -lt 0) {
            Write-Host "   • Upgrade Docker to $RecommendedDockerVersion or later"
        }
        if (-not $JetPack6) {
            Write-Host "   • Set up JetPack 6 environment variables for testing"
            Write-Host "   • For actual deployment, upgrade to JetPack 6.0"
        }
    }
}

# Main execution
function Main {
    $jetpack6 = Test-JetsonPlatform
    Write-Host ""
    
    $dockerOk = Test-Docker
    Write-Host ""
    
    $composeOk = Test-DockerCompose
    Write-Host ""
    
    Test-SystemResources
    Write-Host ""
    
    if ($dockerOk) {
        Test-DockerFunctionality
        Write-Host ""
    }
    
    # Get versions for report
    try {
        $dockerVersionOutput = docker --version 2>$null
        $dockerVersion = ($dockerVersionOutput | Select-String -Pattern '(\d+\.\d+\.\d+)').Matches[0].Groups[1].Value
    } catch {
        $dockerVersion = "Unknown"
    }
    
    try {
        $composeVersionOutput = docker compose version 2>$null
        if (-not $composeVersionOutput) {
            $composeVersionOutput = docker-compose --version 2>$null
        }
        $composeVersion = ($composeVersionOutput | Select-String -Pattern '(\d+\.\d+\.\d+)').Matches[0].Groups[1].Value
    } catch {
        $composeVersion = "Unknown"
    }
    
    Write-CompatibilityReport -JetPack6 $jetpack6 -DockerVersion $dockerVersion -ComposeVersion $composeVersion
    
    Write-Host ""
    if ($dockerOk -and $composeOk) {
        Write-ColorOutput "✅ Docker JetPack 6 compatibility validation complete" "Green"
        return 0
    } else {
        Write-ColorOutput "❌ Docker JetPack 6 compatibility validation failed" "Red"
        return 1
    }
}

# Run main function
$exitCode = Main
exit $exitCode