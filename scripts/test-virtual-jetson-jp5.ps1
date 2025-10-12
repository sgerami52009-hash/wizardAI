# Virtual Jetson JetPack 5.x Testing Script for Windows PowerShell
# Tests the JetPack 5 deployment in a virtual environment

param(
    [switch]$Cleanup,
    [switch]$SkipBuild,
    [switch]$Verbose,
    [switch]$Help
)

if ($Help) {
    Write-Host "Virtual Jetson JetPack 5.x Testing Script" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\scripts\test-virtual-jetson-jp5.ps1 [options]" -ForegroundColor White
    Write-Host ""
    Write-Host "Parameters:" -ForegroundColor Yellow
    Write-Host "  -Cleanup     Clean up test environment and exit" -ForegroundColor White
    Write-Host "  -SkipBuild   Skip Docker image build (use existing)" -ForegroundColor White
    Write-Host "  -Verbose     Enable verbose output" -ForegroundColor White
    Write-Host "  -Help        Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\scripts\test-virtual-jetson-jp5.ps1" -ForegroundColor White
    Write-Host "  .\scripts\test-virtual-jetson-jp5.ps1 -Verbose" -ForegroundColor White
    Write-Host "  .\scripts\test-virtual-jetson-jp5.ps1 -Cleanup" -ForegroundColor White
    exit 0
}

$ContainerName = "virtual-jetson-jp5"
$TestResults = @()
$StartTime = Get-Date

function Write-TestLog {
    param(
        [string]$Message,
        [string]$Level = "Info"
    )
    
    $timestamp = Get-Date -Format "HH:mm:ss"
    $color = switch ($Level) {
        "Success" { "Green" }
        "Warning" { "Yellow" }
        "Error" { "Red" }
        "Test" { "Cyan" }
        default { "Blue" }
    }
    
    Write-Host "[$timestamp] $Message" -ForegroundColor $color
}

function Test-DockerAvailable {
    try {
        $dockerVersion = docker --version 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-TestLog "Docker is available: $dockerVersion" "Success"
            return $true
        }
    } catch {
        Write-TestLog "Docker is not available. Please install Docker Desktop." "Error"
        return $false
    }
    return $false
}

function Start-VirtualJetson {
    Write-TestLog "Setting up Virtual Jetson JetPack 5.x Environment..." "Info"
    
    # Stop existing container if running
    docker stop $ContainerName 2>$null | Out-Null
    docker rm $ContainerName 2>$null | Out-Null
    
    # Build and start virtual environment
    Write-TestLog "Building virtual Jetson environment..." "Info"
    
    if (-not $SkipBuild) {
        $buildResult = docker compose -f deployment/docker-compose.virtual-jetson-jp5.yml up -d --build
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to build virtual Jetson environment"
        }
    } else {
        $startResult = docker compose -f deployment/docker-compose.virtual-jetson-jp5.yml up -d
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to start virtual Jetson environment"
        }
    }
    
    # Wait for container to be ready
    Write-TestLog "Waiting for virtual Jetson to be ready..." "Info"
    Start-Sleep -Seconds 30
    
    # Verify container is running
    $containerStatus = docker ps --filter "name=$ContainerName" --format "{{.Status}}"
    if (-not $containerStatus -or -not $containerStatus.Contains("Up")) {
        throw "Virtual Jetson container failed to start"
    }
    
    Write-TestLog "Virtual Jetson JetPack 5.x environment is ready!" "Success"
}

function Invoke-DockerExec {
    param(
        [string]$Command,
        [string]$User = "",
        [switch]$IgnoreError
    )
    
    $userParam = if ($User) { "-u $User" } else { "" }
    $fullCommand = "docker exec $userParam $ContainerName $Command"
    
    if ($Verbose) {
        Write-TestLog "Executing: $fullCommand" "Info"
    }
    
    $result = Invoke-Expression $fullCommand 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -ne 0 -and -not $IgnoreError) {
        throw "Command failed: $Command. Output: $result"
    }
    
    return @{
        Output = $result
        ExitCode = $exitCode
    }
}

function Test-Step {
    param(
        [string]$Name,
        [scriptblock]$TestFunction
    )
    
    Write-TestLog "Testing: $Name" "Test"
    $stepStart = Get-Date
    
    try {
        & $TestFunction
        $duration = (Get-Date) - $stepStart
        Write-TestLog "✅ $Name - Passed ($($duration.TotalMilliseconds)ms)" "Success"
        $script:TestResults += @{
            Name = $Name
            Status = "PASS"
            Duration = $duration.TotalMilliseconds
        }
        return $true
    } catch {
        $duration = (Get-Date) - $stepStart
        Write-TestLog "❌ $Name - Failed: $($_.Exception.Message)" "Error"
        $script:TestResults += @{
            Name = $Name
            Status = "FAIL"
            Duration = $duration.TotalMilliseconds
            Error = $_.Exception.Message
        }
        return $false
    }
}

function Test-JetPackEnvironment {
    Test-Step "JetPack Version Detection" {
        $result = Invoke-DockerExec "cat /etc/nv_tegra_release"
        if (-not $result.Output.Contains("R35")) {
            throw "JetPack 5.x version not detected"
        }
    }
    
    Test-Step "CUDA 11.4 Availability" {
        $result = Invoke-DockerExec "nvcc --version"
        if (-not $result.Output.Contains("11.4")) {
            throw "CUDA 11.4 not found"
        }
    }
    
    Test-Step "Node.js 18 LTS" {
        $result = Invoke-DockerExec "node --version"
        if (-not $result.Output.StartsWith("v18.")) {
            throw "Node.js 18 LTS not installed"
        }
    }
    
    Test-Step "Memory Configuration (8GB)" {
        $result = Invoke-DockerExec "free -g"
        $memLine = $result.Output -split "`n" | Where-Object { $_.StartsWith("Mem:") }
        $totalMem = ($memLine -split "\s+")[1]
        if ([int]$totalMem -lt 7) {
            throw "Insufficient memory detected"
        }
    }
    
    Test-Step "Audio System Simulation" {
        $result = Invoke-DockerExec "ls -la /dev/snd/"
        if (-not $result.Output.Contains("controlC0")) {
            throw "Audio devices not simulated properly"
        }
    }
}

function Test-ApplicationDeployment {
    Test-Step "Copy Application Files" {
        Invoke-DockerExec "mkdir -p /home/jetson/home-assistant"
        Invoke-DockerExec "cp -r /workspace/* /home/jetson/home-assistant/ || true"
        
        $result = Invoke-DockerExec "ls /home/jetson/home-assistant/package.json" -IgnoreError
        if ($result.ExitCode -ne 0) {
            throw "Application files not copied properly"
        }
    }
    
    Test-Step "Install Dependencies" {
        $result = Invoke-DockerExec "cd /home/jetson/home-assistant && npm ci --production" -User "jetson"
        
        $nodeModulesCheck = Invoke-DockerExec "ls /home/jetson/home-assistant/node_modules" -IgnoreError
        if ($nodeModulesCheck.ExitCode -ne 0) {
            throw "Dependencies not installed properly"
        }
    }
    
    Test-Step "Build Application" {
        # Install dev dependencies for build
        Invoke-DockerExec "cd /home/jetson/home-assistant && npm install" -User "jetson"
        
        $result = Invoke-DockerExec "cd /home/jetson/home-assistant && npm run build" -User "jetson"
        
        $distCheck = Invoke-DockerExec "ls /home/jetson/home-assistant/dist/index.js" -IgnoreError
        if ($distCheck.ExitCode -ne 0) {
            throw "Application build failed"
        }
    }
}

function Test-JetPack5Deployment {
    Test-Step "JetPack 5 Docker Build" {
        $result = Invoke-DockerExec "cd /home/jetson/home-assistant && docker build -f deployment/Dockerfile.jetson-jetpack5 -t test-jetpack5-app ." -User "jetson"
        
        $imageCheck = Invoke-DockerExec "docker images test-jetpack5-app"
        if (-not $imageCheck.Output.Contains("test-jetpack5-app")) {
            throw "JetPack 5 Docker image build failed"
        }
    }
    
    Test-Step "JetPack 5 Container Startup" {
        # Stop any existing test container
        Invoke-DockerExec "docker stop test-jetpack5-container || true" -IgnoreError
        Invoke-DockerExec "docker rm test-jetpack5-container || true" -IgnoreError
        
        # Start test container
        $result = Invoke-DockerExec "docker run -d --name test-jetpack5-container -p 3001:3000 test-jetpack5-app" -User "jetson"
        
        # Wait for container to start
        Start-Sleep -Seconds 10
        
        # Check if container is running
        $containerCheck = Invoke-DockerExec "docker ps --filter name=test-jetpack5-container"
        if (-not $containerCheck.Output.Contains("test-jetpack5-container")) {
            $logs = Invoke-DockerExec "docker logs test-jetpack5-container"
            throw "Container failed to start. Logs: $($logs.Output)"
        }
    }
    
    Test-Step "Application Health Check" {
        # Wait for application to fully start
        Start-Sleep -Seconds 15
        
        $result = Invoke-DockerExec "curl -f http://localhost:3001/health || echo 'Health check failed'"
        
        if ($result.Output.Contains("Health check failed")) {
            $logs = Invoke-DockerExec "docker logs test-jetpack5-container"
            Write-TestLog "Application logs: $($logs.Output)" "Warning"
            throw "Health check endpoint not responding"
        }
    }
}

function Test-ResourceUsage {
    Test-Step "Memory Usage Check" {
        $result = Invoke-DockerExec 'docker stats test-jetpack5-container --no-stream --format "{{.MemUsage}}"'
        $memUsage = $result.Output
        Write-TestLog "Container memory usage: $memUsage" "Info"
        
        if ($memUsage.Contains("GiB") -and [double]($memUsage -split "GiB")[0] -gt 6) {
            throw "Memory usage exceeds JetPack 5 limits"
        }
    }
    
    Test-Step "CPU Usage Check" {
        $result = Invoke-DockerExec 'docker stats test-jetpack5-container --no-stream --format "{{.CPUPerc}}"'
        $cpuUsage = $result.Output
        Write-TestLog "Container CPU usage: $cpuUsage" "Info"
    }
}

function Stop-TestEnvironment {
    Write-TestLog "Cleaning up test environment..." "Info"
    
    try {
        # Stop test containers
        Invoke-DockerExec "docker stop test-jetpack5-container || true" -IgnoreError
        Invoke-DockerExec "docker rm test-jetpack5-container || true" -IgnoreError
        Invoke-DockerExec "docker rmi test-jetpack5-app || true" -IgnoreError
        
        # Stop virtual Jetson
        docker compose -f deployment/docker-compose.virtual-jetson-jp5.yml down 2>$null | Out-Null
        
        Write-TestLog "Cleanup completed" "Success"
    } catch {
        Write-TestLog "Cleanup warning: $($_.Exception.Message)" "Warning"
    }
}

function New-TestReport {
    $totalTime = (Get-Date) - $StartTime
    $passed = ($TestResults | Where-Object { $_.Status -eq "PASS" }).Count
    $failed = ($TestResults | Where-Object { $_.Status -eq "FAIL" }).Count
    
    Write-Host ""
    Write-Host ("=" * 60)
    Write-Host "VIRTUAL JETSON JETPACK 5.x TEST REPORT" -ForegroundColor White
    Write-Host ("=" * 60)
    Write-Host "Passed: $passed" -ForegroundColor Green
    Write-Host "Failed: $failed" -ForegroundColor Red
    Write-Host "Total Time: $($totalTime.TotalMilliseconds)ms"
    Write-Host ("=" * 60)
    
    foreach ($result in $TestResults) {
        $status = if ($result.Status -eq "PASS") { "✅ PASS" } else { "❌ FAIL" }
        $color = if ($result.Status -eq "PASS") { "Green" } else { "Red" }
        Write-Host "$status $($result.Name) ($($result.Duration)ms)" -ForegroundColor $color
        if ($result.Error) {
            Write-Host "    Error: $($result.Error)" -ForegroundColor Red
        }
    }
    
    Write-Host ("=" * 60)
    
    # Save report to file
    $report = @{
        timestamp = (Get-Date).ToString("o")
        totalTime = $totalTime.TotalMilliseconds
        passed = $passed
        failed = $failed
        results = $TestResults
    }
    
    $report | ConvertTo-Json -Depth 3 | Out-File -FilePath "virtual-jetson-jp5-test-report.json" -Encoding UTF8
    Write-TestLog "Test report saved to virtual-jetson-jp5-test-report.json" "Info"
    
    return $failed -eq 0
}

# Main execution
if ($Cleanup) {
    Stop-TestEnvironment
    exit 0
}

try {
    Write-TestLog "Starting Virtual Jetson JetPack 5.x Deployment Test" "Info"
    
    if (-not (Test-DockerAvailable)) {
        exit 1
    }
    
    Start-VirtualJetson
    Test-JetPackEnvironment
    Test-ApplicationDeployment
    Test-JetPack5Deployment
    Test-ResourceUsage
    
    $success = New-TestReport
    
    if ($success) {
        Write-TestLog "🎉 All tests passed! JetPack 5 deployment is working correctly." "Success"
    } else {
        Write-TestLog "⚠️ Some tests failed. Check the report for details." "Warning"
    }
    
    exit $(if ($success) { 0 } else { 1 })
    
} catch {
    Write-TestLog "Fatal error: $($_.Exception.Message)" "Error"
    exit 1
} finally {
    Stop-TestEnvironment
}