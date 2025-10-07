#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Comprehensive Deployment Validation for Jetson Home Assistant
    
.DESCRIPTION
    This script runs a complete validation of the Home Assistant deployment
    in a virtual Jetson Orin Nano environment. It tests all components,
    features, and performance characteristics to ensure the system is
    ready for production deployment.
    
.PARAMETER Verbose
    Enable verbose output for detailed logging
    
.PARAMETER SkipCleanup
    Skip cleanup after validation (useful for debugging)
    
.PARAMETER TimeoutMinutes
    Timeout for the entire validation process (default: 10 minutes)
    
.EXAMPLE
    .\scripts\run-comprehensive-validation.ps1
    
.EXAMPLE
    .\scripts\run-comprehensive-validation.ps1 -Verbose -TimeoutMinutes 15
#>

param(
    [switch]$Verbose,
    [switch]$SkipCleanup,
    [int]$TimeoutMinutes = 10
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Enable verbose output if requested
if ($Verbose) {
    $VerbosePreference = "Continue"
}

# Script configuration
$ScriptName = "Comprehensive Deployment Validation"
$ValidationScript = "scripts/comprehensive-deployment-validation.js"
$LogDir = "logs/validation"
$StartTime = Get-Date

Write-Host "🚀 $ScriptName" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan
Write-Host "Start Time: $($StartTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Gray
Write-Host "Timeout: $TimeoutMinutes minutes" -ForegroundColor Gray
Write-Host ""

# Function to write colored output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-ColorOutput "🔍 Checking Prerequisites..." "Yellow"
    
    $prerequisites = @(
        @{ Name = "Node.js"; Command = "node --version"; MinVersion = "18.0.0" },
        @{ Name = "NPM"; Command = "npm --version"; MinVersion = "8.0.0" },
        @{ Name = "PowerShell"; Command = '$PSVersionTable.PSVersion.ToString()'; MinVersion = "5.1.0" }
    )
    
    $allPassed = $true
    
    foreach ($prereq in $prerequisites) {
        try {
            if ($prereq.Command.StartsWith('$')) {
                $version = Invoke-Expression $prereq.Command
            } else {
                $version = Invoke-Expression $prereq.Command 2>$null
            }
            
            if ($version) {
                Write-ColorOutput "  ✅ $($prereq.Name): $version" "Green"
            } else {
                Write-ColorOutput "  ❌ $($prereq.Name): Not found" "Red"
                $allPassed = $false
            }
        } catch {
            Write-ColorOutput "  ❌ $($prereq.Name): Error checking version" "Red"
            $allPassed = $false
        }
    }
    
    # Check required files
    $requiredFiles = @(
        "package.json",
        "dist/index.js",
        "dist/health-check.js",
        "simple-jetson-test.js",
        $ValidationScript
    )
    
    foreach ($file in $requiredFiles) {
        if (Test-Path $file) {
            Write-ColorOutput "  ✅ File: $file" "Green"
        } else {
            Write-ColorOutput "  ❌ File missing: $file" "Red"
            $allPassed = $false
        }
    }
    
    if (-not $allPassed) {
        throw "Prerequisites check failed. Please install missing components."
    }
    
    Write-ColorOutput "✅ All prerequisites satisfied" "Green"
    Write-Host ""
}

# Function to prepare environment
function Initialize-Environment {
    Write-ColorOutput "🔧 Preparing Validation Environment..." "Yellow"
    
    # Create log directory
    if (-not (Test-Path $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
        Write-ColorOutput "  📁 Created log directory: $LogDir" "Gray"
    }
    
    # Create temp directories
    $tempDirs = @("temp/validation", "cache/validation")
    foreach ($dir in $tempDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-ColorOutput "  📁 Created directory: $dir" "Gray"
        }
    }
    
    # Check available ports
    $requiredPorts = @(3000, 8080)
    foreach ($port in $requiredPorts) {
        $connection = Test-NetConnection -ComputerName "localhost" -Port $port -InformationLevel Quiet -WarningAction SilentlyContinue
        if ($connection) {
            Write-ColorOutput "  ⚠️  Port $port is in use - validation may fail" "Yellow"
        } else {
            Write-ColorOutput "  ✅ Port $port is available" "Green"
        }
    }
    
    Write-ColorOutput "✅ Environment prepared" "Green"
    Write-Host ""
}

# Function to run validation with timeout
function Start-ValidationWithTimeout {
    param(
        [int]$TimeoutSeconds
    )
    
    Write-ColorOutput "🧪 Starting Comprehensive Validation..." "Yellow"
    Write-ColorOutput "Timeout: $TimeoutSeconds seconds" "Gray"
    Write-Host ""
    
    # Start validation process
    $processArgs = @{
        FilePath = "node"
        ArgumentList = @($ValidationScript)
        NoNewWindow = $true
        PassThru = $true
        RedirectStandardOutput = $true
        RedirectStandardError = $true
    }
    
    $process = Start-Process @processArgs
    
    # Create output monitoring jobs
    $outputJob = Start-Job -ScriptBlock {
        param($ProcessId)
        $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($process) {
            $process.StandardOutput.ReadToEnd()
        }
    } -ArgumentList $process.Id
    
    $errorJob = Start-Job -ScriptBlock {
        param($ProcessId)
        $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
        if ($process) {
            $process.StandardError.ReadToEnd()
        }
    } -ArgumentList $process.Id
    
    # Wait for completion or timeout
    $completed = $process.WaitForExit($TimeoutSeconds * 1000)
    
    if ($completed) {
        $exitCode = $process.ExitCode
        
        # Get output
        $output = Receive-Job -Job $outputJob -Wait
        $errors = Receive-Job -Job $errorJob -Wait
        
        # Clean up jobs
        Remove-Job -Job $outputJob, $errorJob -Force
        
        # Display output
        if ($output) {
            Write-Host $output
        }
        
        if ($errors) {
            Write-ColorOutput "Errors:" "Red"
            Write-Host $errors -ForegroundColor Red
        }
        
        return @{
            ExitCode = $exitCode
            Output = $output
            Errors = $errors
            TimedOut = $false
        }
    } else {
        # Process timed out
        Write-ColorOutput "⏰ Validation timed out after $TimeoutSeconds seconds" "Red"
        
        try {
            $process.Kill()
            $process.WaitForExit(5000)
        } catch {
            Write-ColorOutput "Warning: Could not kill validation process" "Yellow"
        }
        
        # Clean up jobs
        Remove-Job -Job $outputJob, $errorJob -Force
        
        return @{
            ExitCode = -1
            Output = ""
            Errors = "Validation timed out"
            TimedOut = $true
        }
    }
}

# Function to analyze results
function Get-ValidationResults {
    Write-ColorOutput "📊 Analyzing Validation Results..." "Yellow"
    
    # Find the latest validation report
    $reportFiles = Get-ChildItem -Path $LogDir -Filter "deployment-validation-*.json" -ErrorAction SilentlyContinue | 
                   Sort-Object LastWriteTime -Descending
    
    if ($reportFiles.Count -eq 0) {
        Write-ColorOutput "  ⚠️  No validation report found" "Yellow"
        return $null
    }
    
    $latestReport = $reportFiles[0]
    Write-ColorOutput "  📄 Reading report: $($latestReport.Name)" "Gray"
    
    try {
        $reportContent = Get-Content -Path $latestReport.FullName -Raw | ConvertFrom-Json
        
        Write-ColorOutput "📋 VALIDATION SUMMARY" "Cyan"
        Write-ColorOutput "===================" "Cyan"
        Write-ColorOutput "Overall Status: $($reportContent.overallStatus)" $(if ($reportContent.overallStatus -eq "PASSED") { "Green" } else { "Red" })
        Write-ColorOutput "Total Tests: $($reportContent.totalTests)" "White"
        Write-ColorOutput "Passed: $($reportContent.passedTests)" "Green"
        Write-ColorOutput "Failed: $($reportContent.failedTests)" $(if ($reportContent.failedTests -eq 0) { "Green" } else { "Red" })
        Write-ColorOutput "Skipped: $($reportContent.skippedTests)" "Yellow"
        
        if ($reportContent.totalTests -gt 0) {
            $successRate = [math]::Round(($reportContent.passedTests / ($reportContent.passedTests + $reportContent.failedTests)) * 100, 1)
            Write-ColorOutput "Success Rate: $successRate%" $(if ($successRate -ge 90) { "Green" } elseif ($successRate -ge 70) { "Yellow" } else { "Red" })
        }
        
        $durationSeconds = [math]::Round($reportContent.duration / 1000, 1)
        Write-ColorOutput "Duration: ${durationSeconds}s" "White"
        Write-ColorOutput "Deployment Status: $($reportContent.deploymentStatus)" $(if ($reportContent.deploymentStatus -eq "RUNNING") { "Green" } else { "Red" })
        
        # Category breakdown
        if ($reportContent.categories) {
            Write-Host ""
            Write-ColorOutput "📊 CATEGORY RESULTS" "Cyan"
            Write-ColorOutput "==================" "Cyan"
            
            foreach ($category in $reportContent.categories.PSObject.Properties) {
                $categoryName = $category.Name
                $categoryData = $category.Value
                $categorySuccessRate = [math]::Round(($categoryData.passed / $categoryData.total) * 100, 1)
                $status = if ($categoryData.failed -eq 0) { "✅" } else { "❌" }
                
                Write-ColorOutput "$status ${categoryName}: $($categoryData.passed)/$($categoryData.total) ($categorySuccessRate%)" "White"
            }
        }
        
        # System metrics
        if ($reportContent.systemMetrics -and $reportContent.systemMetrics.memory) {
            Write-Host ""
            Write-ColorOutput "💾 SYSTEM METRICS" "Cyan"
            Write-ColorOutput "=================" "Cyan"
            Write-ColorOutput "Memory Usage: $($reportContent.systemMetrics.memory.rss)MB" "White"
            Write-ColorOutput "Heap Usage: $($reportContent.systemMetrics.memory.heapUsed)MB" "White"
            
            if ($reportContent.systemMetrics.application) {
                Write-ColorOutput "App Status: $($reportContent.systemMetrics.application.status)" $(if ($reportContent.systemMetrics.application.status -eq "healthy") { "Green" } else { "Red" })
            }
        }
        
        return $reportContent
    } catch {
        Write-ColorOutput "  ❌ Error reading validation report: $($_.Exception.Message)" "Red"
        return $null
    }
}

# Function to cleanup
function Invoke-Cleanup {
    if ($SkipCleanup) {
        Write-ColorOutput "⏭️  Skipping cleanup (as requested)" "Yellow"
        return
    }
    
    Write-ColorOutput "🧹 Cleaning up..." "Yellow"
    
    # Kill any remaining Node.js processes that might be from our validation
    $nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue | 
                     Where-Object { $_.StartTime -gt $StartTime.AddMinutes(-1) }
    
    foreach ($process in $nodeProcesses) {
        try {
            Write-ColorOutput "  🔪 Stopping Node.js process (PID: $($process.Id))" "Gray"
            $process.Kill()
            $process.WaitForExit(5000)
        } catch {
            Write-ColorOutput "  ⚠️  Could not stop process PID: $($process.Id)" "Yellow"
        }
    }
    
    # Clean up temporary files (but keep logs)
    $tempPaths = @("temp/validation", "cache/validation")
    foreach ($path in $tempPaths) {
        if (Test-Path $path) {
            try {
                Remove-Item -Path $path -Recurse -Force
                Write-ColorOutput "  🗑️  Cleaned: $path" "Gray"
            } catch {
                Write-ColorOutput "  ⚠️  Could not clean: $path" "Yellow"
            }
        }
    }
    
    Write-ColorOutput "✅ Cleanup completed" "Green"
}

# Main execution
try {
    # Check prerequisites
    Test-Prerequisites
    
    # Prepare environment
    Initialize-Environment
    
    # Run validation with timeout
    $timeoutSeconds = $TimeoutMinutes * 60
    $validationResult = Start-ValidationWithTimeout -TimeoutSeconds $timeoutSeconds
    
    # Analyze results
    $reportData = Get-ValidationResults
    
    # Calculate total duration
    $endTime = Get-Date
    $totalDuration = $endTime - $StartTime
    
    Write-Host ""
    Write-ColorOutput "🏁 VALIDATION COMPLETED" "Cyan"
    Write-ColorOutput "=======================" "Cyan"
    Write-ColorOutput "Total Duration: $($totalDuration.ToString('mm\:ss'))" "White"
    Write-ColorOutput "End Time: $($endTime.ToString('yyyy-MM-dd HH:mm:ss'))" "Gray"
    
    # Determine final result
    if ($validationResult.TimedOut) {
        Write-ColorOutput "❌ VALIDATION TIMED OUT" "Red"
        Write-ColorOutput "The validation process exceeded the $TimeoutMinutes minute timeout." "Red"
        $exitCode = 2
    } elseif ($validationResult.ExitCode -eq 0) {
        Write-ColorOutput "✅ VALIDATION PASSED" "Green"
        Write-ColorOutput "🚀 The Home Assistant is ready for production deployment!" "Green"
        $exitCode = 0
    } else {
        Write-ColorOutput "❌ VALIDATION FAILED" "Red"
        Write-ColorOutput "Please review the test results and fix issues before deployment." "Red"
        $exitCode = 1
    }
    
    # Show next steps
    Write-Host ""
    Write-ColorOutput "📋 NEXT STEPS" "Cyan"
    Write-ColorOutput "=============" "Cyan"
    
    if ($exitCode -eq 0) {
        Write-ColorOutput "1. ✅ Virtual validation passed - system is ready" "Green"
        Write-ColorOutput "2. 🚀 Deploy to physical Jetson Orin Nano:" "White"
        Write-ColorOutput "   .\deployment\deploy-jetson-ip.ps1 -IpAddress <JETSON_IP> -Username jetson" "Gray"
        Write-ColorOutput "3. 📱 Or create USB installer:" "White"
        Write-ColorOutput "   .\deployment\create-usb-installer.ps1 -UsbDrive E:" "Gray"
    } else {
        Write-ColorOutput "1. 🔍 Review validation report in: $LogDir" "Yellow"
        Write-ColorOutput "2. 🔧 Fix identified issues" "Yellow"
        Write-ColorOutput "3. 🔄 Re-run validation: .\scripts\run-comprehensive-validation.ps1" "Yellow"
    }
    
} catch {
    Write-ColorOutput "💥 VALIDATION ERROR" "Red"
    Write-ColorOutput "==================" "Red"
    Write-ColorOutput "Error: $($_.Exception.Message)" "Red"
    
    if ($Verbose) {
        Write-ColorOutput "Stack Trace:" "Red"
        Write-Host $_.ScriptStackTrace -ForegroundColor Red
    }
    
    $exitCode = 3
} finally {
    # Always cleanup
    Invoke-Cleanup
    
    Write-Host ""
    $statusText = if ($exitCode -eq 0) { 'SUCCESS ✅' } else { 'FAILED ❌' }
    $statusColor = if ($exitCode -eq 0) { "Green" } else { "Red" }
    Write-ColorOutput "📊 Final Status: $statusText" $statusColor
}

# Exit with appropriate code
exit $exitCode