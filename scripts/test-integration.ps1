# Avatar System Integration Test Runner (PowerShell)
# Script to run integration tests with proper setup on Windows

param(
    [switch]$Cleanup = $true,
    [switch]$Verbose = $true
)

Write-Host "🚀 Avatar System Integration Tests" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green

try {
    # Set environment variables
    $env:NODE_ENV = "test"
    $env:AVATAR_TEST_MODE = "true"
    $env:AVATAR_LOG_LEVEL = "warn"
    $env:AVATAR_DISABLE_HARDWARE_CHECKS = "true"

    # Create test directories
    Write-Host "📁 Creating test directories..." -ForegroundColor Blue
    New-Item -ItemType Directory -Path "test-data/integration" -Force | Out-Null
    New-Item -ItemType Directory -Path "test-reports/integration" -Force | Out-Null
    New-Item -ItemType Directory -Path "coverage/integration" -Force | Out-Null

    # Check if Node.js is available
    try {
        $nodeVersion = node --version
        Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Node.js not found. Please install Node.js." -ForegroundColor Red
        exit 1
    }

    # Check if npm/npx is available
    try {
        $npmVersion = npm --version
        Write-Host "✅ npm version: $npmVersion" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ npm not found. Please install npm." -ForegroundColor Red
        exit 1
    }

    # Run integration tests
    Write-Host "🧪 Running integration tests..." -ForegroundColor Blue

    $jestArgs = @(
        "jest",
        "--testMatch=**/avatar/*integration*.test.ts",
        "--testTimeout=60000",
        "--maxWorkers=1",
        "--detectOpenHandles",
        "--forceExit",
        "--no-cache",
        "--passWithNoTests"
    )

    if ($Verbose) {
        $jestArgs += "--verbose"
    }

    # Execute Jest
    $testProcess = Start-Process -FilePath "npx" -ArgumentList $jestArgs -Wait -PassThru -NoNewWindow

    $testExitCode = $testProcess.ExitCode

    Write-Host ""
    if ($testExitCode -eq 0) {
        Write-Host "✅ Integration tests completed successfully!" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Integration tests failed with exit code $testExitCode" -ForegroundColor Red
    }

    # Generate simple report
    Write-Host "📊 Test Summary:" -ForegroundColor Blue
    Write-Host "  Environment: $($env:NODE_ENV)"
    Write-Host "  Test Mode: $($env:AVATAR_TEST_MODE)"
    Write-Host "  Exit Code: $testExitCode"
    Write-Host "  Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

    # Create summary file
    $summary = @{
        timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
        environment = $env:NODE_ENV
        testMode = $env:AVATAR_TEST_MODE
        exitCode = $testExitCode
        success = ($testExitCode -eq 0)
        platform = "Windows"
        nodeVersion = $nodeVersion
        npmVersion = $npmVersion
    }

    $summaryJson = $summary | ConvertTo-Json -Depth 2
    $summaryPath = "test-reports/integration/test-summary.json"
    $summaryJson | Out-File -FilePath $summaryPath -Encoding UTF8

    Write-Host "📄 Summary saved to: $summaryPath" -ForegroundColor Blue

    # Cleanup (optional)
    if ($Cleanup -and $env:AVATAR_CLEANUP_TEST_DATA -ne "false") {
        Write-Host "🧹 Cleaning up test data..." -ForegroundColor Blue
        Remove-Item -Path "test-data/integration" -Recurse -Force -ErrorAction SilentlyContinue
    }

    exit $testExitCode
}
catch {
    Write-Host "💥 Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    # Restore environment
    Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    Remove-Item Env:AVATAR_TEST_MODE -ErrorAction SilentlyContinue
    Remove-Item Env:AVATAR_LOG_LEVEL -ErrorAction SilentlyContinue
    Remove-Item Env:AVATAR_DISABLE_HARDWARE_CHECKS -ErrorAction SilentlyContinue
}