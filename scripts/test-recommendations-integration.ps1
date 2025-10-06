# PowerShell script to run Recommendations Engine Integration Tests
# Optimized for Windows environment with comprehensive test execution

param(
    [string]$TestPattern = "*integration*.test.ts",
    [switch]$Coverage = $false,
    [switch]$Verbose = $false,
    [switch]$Watch = $false,
    [string]$OutputDir = "./test-reports/recommendations-integration",
    [int]$Timeout = 120000,
    [switch]$CleanFirst = $false
)

Write-Host "🚀 Starting Recommendations Engine Integration Tests" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green

# Set error handling
$ErrorActionPreference = "Stop"

try {
    # Clean up previous test artifacts if requested
    if ($CleanFirst) {
        Write-Host "🧹 Cleaning up previous test artifacts..." -ForegroundColor Yellow
        
        if (Test-Path "./test-data/recommendations-integration") {
            Remove-Item -Path "./test-data/recommendations-integration" -Recurse -Force -ErrorAction SilentlyContinue
        }
        
        if (Test-Path "./test-reports/recommendations-integration") {
            Remove-Item -Path "./test-reports/recommendations-integration" -Recurse -Force -ErrorAction SilentlyContinue
        }
        
        if (Test-Path "./coverage/recommendations-integration") {
            Remove-Item -Path "./coverage/recommendations-integration" -Recurse -Force -ErrorAction SilentlyContinue
        }
        
        Write-Host "✅ Cleanup completed" -ForegroundColor Green
    }

    # Create output directories
    Write-Host "📁 Creating output directories..." -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    New-Item -ItemType Directory -Path "./coverage/recommendations-integration" -Force | Out-Null
    New-Item -ItemType Directory -Path "./test-data/recommendations-integration" -Force | Out-Null

    # Set environment variables for testing
    Write-Host "🔧 Setting up test environment..." -ForegroundColor Cyan
    $env:NODE_ENV = "test"
    $env:RECOMMENDATIONS_TEST_MODE = "true"
    $env:RECOMMENDATIONS_LOG_LEVEL = "warn"
    $env:RECOMMENDATIONS_DISABLE_EXTERNAL_APIS = "true"
    $env:RECOMMENDATIONS_MOCK_INTEGRATIONS = "true"
    
    # Build Jest command
    $jestArgs = @(
        "--config", "jest.recommendations-integration.config.js",
        "--testTimeout", $Timeout,
        "--testPathPattern", $TestPattern,
        "--runInBand", # Run tests serially for integration tests
        "--forceExit"
    )
    
    if ($Coverage) {
        $jestArgs += "--coverage"
        Write-Host "📊 Coverage reporting enabled" -ForegroundColor Cyan
    }
    
    if ($Verbose) {
        $jestArgs += "--verbose"
        Write-Host "🔍 Verbose output enabled" -ForegroundColor Cyan
    }
    
    if ($Watch) {
        $jestArgs += "--watch"
        Write-Host "👀 Watch mode enabled" -ForegroundColor Cyan
    } else {
        $jestArgs += "--ci"
    }

    # Check if Jest is available
    Write-Host "🔍 Checking Jest availability..." -ForegroundColor Cyan
    try {
        $jestVersion = & npx jest --version 2>$null
        Write-Host "✅ Jest version: $jestVersion" -ForegroundColor Green
    } catch {
        Write-Host "❌ Jest not found. Installing dependencies..." -ForegroundColor Red
        & npm install
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to install dependencies"
        }
    }

    # Run pre-test validation
    Write-Host "🔍 Running pre-test validation..." -ForegroundColor Cyan
    
    # Check if required test files exist
    $requiredFiles = @(
        "./recommendations/integration/end-to-end-integration.test.ts",
        "./jest.recommendations-integration.config.js",
        "./recommendations/integration/integration-test-setup.ts"
    )
    
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            throw "Required test file not found: $file"
        }
    }
    
    Write-Host "✅ Pre-test validation passed" -ForegroundColor Green

    # Display test configuration
    Write-Host "📋 Test Configuration:" -ForegroundColor Cyan
    Write-Host "  Test Pattern: $TestPattern" -ForegroundColor White
    Write-Host "  Timeout: $($Timeout)ms" -ForegroundColor White
    Write-Host "  Coverage: $Coverage" -ForegroundColor White
    Write-Host "  Verbose: $Verbose" -ForegroundColor White
    Write-Host "  Watch Mode: $Watch" -ForegroundColor White
    Write-Host "  Output Directory: $OutputDir" -ForegroundColor White

    # Run the integration tests
    Write-Host "🧪 Running Recommendations Engine Integration Tests..." -ForegroundColor Green
    Write-Host "This may take several minutes for comprehensive testing..." -ForegroundColor Yellow
    
    $startTime = Get-Date
    
    & npx jest @jestArgs
    $testExitCode = $LASTEXITCODE
    
    $endTime = Get-Date
    $duration = $endTime - $startTime
    
    # Display results
    Write-Host "" -ForegroundColor White
    Write-Host "=================================================" -ForegroundColor Green
    
    if ($testExitCode -eq 0) {
        Write-Host "✅ All integration tests passed!" -ForegroundColor Green
        Write-Host "⏱️  Total execution time: $($duration.ToString('mm\:ss'))" -ForegroundColor Cyan
        
        # Display coverage information if enabled
        if ($Coverage -and (Test-Path "./coverage/recommendations-integration/lcov-report/index.html")) {
            Write-Host "📊 Coverage report generated: ./coverage/recommendations-integration/lcov-report/index.html" -ForegroundColor Cyan
        }
        
        # Display test reports
        if (Test-Path "$OutputDir/recommendations-integration-test-report.html") {
            Write-Host "📋 Test report generated: $OutputDir/recommendations-integration-test-report.html" -ForegroundColor Cyan
        }
        
        # Display performance summary if available
        if (Test-Path "$OutputDir/performance-summary.json") {
            Write-Host "⚡ Performance summary: $OutputDir/performance-summary.json" -ForegroundColor Cyan
        }
        
    } else {
        Write-Host "❌ Some integration tests failed!" -ForegroundColor Red
        Write-Host "⏱️  Total execution time: $($duration.ToString('mm\:ss'))" -ForegroundColor Cyan
        Write-Host "📋 Check test reports for details: $OutputDir" -ForegroundColor Yellow
    }

    # Display additional information
    Write-Host "" -ForegroundColor White
    Write-Host "📁 Test Artifacts:" -ForegroundColor Cyan
    Write-Host "  Test Reports: $OutputDir" -ForegroundColor White
    Write-Host "  Coverage Reports: ./coverage/recommendations-integration" -ForegroundColor White
    Write-Host "  Test Data: ./test-data/recommendations-integration" -ForegroundColor White

    # Performance summary
    Write-Host "" -ForegroundColor White
    Write-Host "🎯 Test Categories Covered:" -ForegroundColor Cyan
    Write-Host "  ✓ Complete Recommendation Workflows" -ForegroundColor Green
    Write-Host "  ✓ Multi-User Family Scenarios" -ForegroundColor Green
    Write-Host "  ✓ Avatar System Integration" -ForegroundColor Green
    Write-Host "  ✓ Voice Pipeline Integration" -ForegroundColor Green
    Write-Host "  ✓ Scheduling System Integration" -ForegroundColor Green
    Write-Host "  ✓ Smart Home Integration" -ForegroundColor Green
    Write-Host "  ✓ Performance & Error Handling" -ForegroundColor Green
    Write-Host "  ✓ Privacy & Child Safety" -ForegroundColor Green
    Write-Host "  ✓ Feedback & Learning" -ForegroundColor Green

    exit $testExitCode

} catch {
    Write-Host "" -ForegroundColor White
    Write-Host "❌ Test execution failed!" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "" -ForegroundColor White
    Write-Host "🔧 Troubleshooting Tips:" -ForegroundColor Yellow
    Write-Host "  1. Ensure all dependencies are installed: npm install" -ForegroundColor White
    Write-Host "  2. Check that TypeScript is compiled: npm run build" -ForegroundColor White
    Write-Host "  3. Verify test files exist in recommendations/integration/" -ForegroundColor White
    Write-Host "  4. Check Jest configuration: jest.recommendations-integration.config.js" -ForegroundColor White
    Write-Host "  5. Review test setup files for any missing dependencies" -ForegroundColor White
    
    exit 1
} finally {
    # Clean up environment variables
    Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    Remove-Item Env:RECOMMENDATIONS_TEST_MODE -ErrorAction SilentlyContinue
    Remove-Item Env:RECOMMENDATIONS_LOG_LEVEL -ErrorAction SilentlyContinue
    Remove-Item Env:RECOMMENDATIONS_DISABLE_EXTERNAL_APIS -ErrorAction SilentlyContinue
    Remove-Item Env:RECOMMENDATIONS_MOCK_INTEGRATIONS -ErrorAction SilentlyContinue
}