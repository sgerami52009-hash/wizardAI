# System Validation Test Runner for Windows PowerShell
# Runs comprehensive system validation and acceptance tests for the personalized recommendations engine

Write-Host "🚀 Starting System Validation Tests for Personalized Recommendations Engine" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow

# Check Node.js version
$nodeVersion = node --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js not found. Please install Node.js 16 or higher." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Node.js version: $nodeVersion" -ForegroundColor Green

# Check npm/yarn
$packageManager = "npm"
if (Get-Command yarn -ErrorAction SilentlyContinue) {
    $packageManager = "yarn"
}
Write-Host "✅ Package manager: $packageManager" -ForegroundColor Green

# Install dependencies if needed
Write-Host "📦 Checking dependencies..." -ForegroundColor Yellow
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    if ($packageManager -eq "yarn") {
        yarn install
    } else {
        npm install
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
}

# Create necessary directories
Write-Host "📁 Setting up test environment..." -ForegroundColor Yellow
$testDirs = @(
    "test-data/temp",
    "test-data/logs", 
    "test-data/cache",
    "coverage/system-validation",
    "recommendations/validation-reports"
)

foreach ($dir in $testDirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
        Write-Host "   Created directory: $dir" -ForegroundColor Gray
    }
}

# Set environment variables
$env:NODE_ENV = "test"
$env:TEST_MODE = "system_validation"
$env:LOG_LEVEL = "error"

Write-Host "✅ Test environment setup complete" -ForegroundColor Green

# Run TypeScript compilation check
Write-Host "🔧 Checking TypeScript compilation..." -ForegroundColor Yellow
npx tsc --noEmit --project tsconfig.json
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  TypeScript compilation issues detected, but continuing..." -ForegroundColor Yellow
}

# Run system validation tests
Write-Host "🧪 Running System Validation Tests..." -ForegroundColor Cyan
Write-Host "   This may take several minutes..." -ForegroundColor Gray

$testStartTime = Get-Date

# Run Jest with system validation configuration
npx jest --config=jest.system-validation.config.js --verbose --coverage --detectOpenHandles --forceExit

$testExitCode = $LASTEXITCODE
$testEndTime = Get-Date
$testDuration = $testEndTime - $testStartTime

# Display results
Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "📊 System Validation Test Results" -ForegroundColor Green
Write-Host "=================================================================" -ForegroundColor Cyan

if ($testExitCode -eq 0) {
    Write-Host "✅ All tests passed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Some tests failed. Check the detailed report for more information." -ForegroundColor Red
}

Write-Host "⏱️  Total execution time: $($testDuration.ToString('mm\:ss'))" -ForegroundColor Cyan

# Check if reports were generated
$reportsDir = "recommendations/validation-reports"
if (Test-Path $reportsDir) {
    Write-Host "`n📄 Generated Reports:" -ForegroundColor Yellow
    Get-ChildItem $reportsDir -File | ForEach-Object {
        Write-Host "   - $($_.Name)" -ForegroundColor Gray
    }
    
    # Display summary if available
    $summaryFile = Join-Path $reportsDir "test-results-summary.md"
    if (Test-Path $summaryFile) {
        Write-Host "`n📋 Test Summary:" -ForegroundColor Yellow
        $summary = Get-Content $summaryFile -Raw
        # Extract key metrics from markdown
        if ($summary -match "Total Tests.*?(\d+)") {
            Write-Host "   Total Tests: $($matches[1])" -ForegroundColor Gray
        }
        if ($summary -match "Passed.*?(\d+)") {
            Write-Host "   Passed: $($matches[1])" -ForegroundColor Green
        }
        if ($summary -match "Failed.*?(\d+)") {
            Write-Host "   Failed: $($matches[1])" -ForegroundColor Red
        }
    }
}

# Check coverage report
$coverageDir = "coverage/system-validation"
if (Test-Path $coverageDir) {
    Write-Host "`n📊 Coverage Report:" -ForegroundColor Yellow
    $coverageFile = Join-Path $coverageDir "lcov-report/index.html"
    if (Test-Path $coverageFile) {
        Write-Host "   HTML Report: $coverageFile" -ForegroundColor Gray
        Write-Host "   Open this file in a browser to view detailed coverage" -ForegroundColor Gray
    }
}

# Performance validation
Write-Host "`n⚡ Performance Validation:" -ForegroundColor Yellow
$performanceReport = Join-Path $reportsDir "performance-report.json"
if (Test-Path $performanceReport) {
    try {
        $perfData = Get-Content $performanceReport | ConvertFrom-Json
        Write-Host "   Peak Memory Usage: $([math]::Round($perfData.memory.peak, 2))MB" -ForegroundColor Gray
        Write-Host "   Average Response Time: $([math]::Round($perfData.performance.averageResponseTime, 2))ms" -ForegroundColor Gray
        
        if ($perfData.compliance.memoryConstraintMet) {
            Write-Host "   Memory Constraint (< 1536MB): ✅ PASSED" -ForegroundColor Green
        } else {
            Write-Host "   Memory Constraint (< 1536MB): ❌ FAILED" -ForegroundColor Red
        }
        
        if ($perfData.compliance.responseTimeConstraintMet) {
            Write-Host "   Response Time Constraint (< 2000ms): ✅ PASSED" -ForegroundColor Green
        } else {
            Write-Host "   Response Time Constraint (< 2000ms): ❌ FAILED" -ForegroundColor Red
        }
    } catch {
        Write-Host "   Could not parse performance report" -ForegroundColor Yellow
    }
}

# Recommendations
if ($testExitCode -ne 0) {
    Write-Host "`n💡 Recommendations:" -ForegroundColor Yellow
    Write-Host "   1. Check the detailed test report for specific failures" -ForegroundColor Gray
    Write-Host "   2. Review performance metrics if constraints were exceeded" -ForegroundColor Gray
    Write-Host "   3. Ensure all child safety validations are passing" -ForegroundColor Gray
    Write-Host "   4. Verify privacy compliance requirements are met" -ForegroundColor Gray
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "System validation test execution completed." -ForegroundColor Green

# Open reports in browser if requested
if ($args -contains "--open-reports") {
    $htmlReport = Join-Path $coverageDir "html-report/system-validation-report.html"
    if (Test-Path $htmlReport) {
        Write-Host "🌐 Opening test report in browser..." -ForegroundColor Yellow
        Start-Process $htmlReport
    }
}

# Exit with appropriate code
exit $testExitCode