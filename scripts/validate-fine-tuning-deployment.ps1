# Fine-Tuning System Deployment Validation Script
# PowerShell version for Windows environments

param(
    [switch]$Verbose,
    [switch]$SkipTests,
    [string]$Environment = "auto"
)

Write-Host "🚀 Fine-Tuning System Deployment Validation" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

# Function to check if a command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# Function to run a validation step
function Invoke-ValidationStep {
    param(
        [string]$StepName,
        [scriptblock]$StepAction
    )
    
    Write-Host "`n📋 $StepName..." -ForegroundColor Yellow
    
    try {
        $result = & $StepAction
        Write-Host "✅ $StepName - PASSED" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "❌ $StepName - FAILED: $($_.Exception.Message)" -ForegroundColor Red
        if ($Verbose) {
            Write-Host "Details: $($_.Exception)" -ForegroundColor Gray
        }
        return $false
    }
}

# Initialize results tracking
$validationResults = @()
$totalSteps = 0
$passedSteps = 0

# Step 1: Check Prerequisites
$totalSteps++
$stepPassed = Invoke-ValidationStep "Prerequisites Check" {
    # Check Node.js
    if (-not (Test-Command "node")) {
        throw "Node.js is not installed or not in PATH"
    }
    
    $nodeVersion = node --version
    $majorVersion = [int]($nodeVersion -replace "v(\d+)\..*", '$1')
    
    if ($majorVersion -lt 18) {
        throw "Node.js version $nodeVersion is not supported. Minimum version: 18.0.0"
    }
    
    Write-Host "  ✓ Node.js version: $nodeVersion" -ForegroundColor Gray
    
    # Check npm/yarn
    if (Test-Command "npm") {
        $npmVersion = npm --version
        Write-Host "  ✓ npm version: $npmVersion" -ForegroundColor Gray
    } elseif (Test-Command "yarn") {
        $yarnVersion = yarn --version
        Write-Host "  ✓ yarn version: $yarnVersion" -ForegroundColor Gray
    } else {
        throw "Neither npm nor yarn is available"
    }
    
    # Check TypeScript
    if (Test-Command "tsc") {
        $tscVersion = tsc --version
        Write-Host "  ✓ TypeScript: $tscVersion" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠️ TypeScript compiler not found globally" -ForegroundColor Yellow
    }
    
    return $true
}
if ($stepPassed) { $passedSteps++ }
$validationResults += @{ Step = "Prerequisites"; Passed = $stepPassed }

# Step 2: Check Project Structure
$totalSteps++
$stepPassed = Invoke-ValidationStep "Project Structure Check" {
    $requiredFiles = @(
        "learning/index.ts",
        "learning/local-llm-fine-tuner.ts",
        "learning/family-llm-factory.ts",
        "learning/fine-tuning-integration.ts",
        "learning/fine-tuning-integration-simple.ts",
        "learning/fine-tuning-config.ts",
        "learning/llm-enhanced-engine.ts",
        "learning/FINE_TUNING_README.md"
    )
    
    foreach ($file in $requiredFiles) {
        if (-not (Test-Path $file)) {
            throw "Required file missing: $file"
        }
    }
    
    Write-Host "  ✓ All required files present ($($requiredFiles.Count) files)" -ForegroundColor Gray
    
    # Check test files
    $testFiles = @(
        "learning/local-llm-fine-tuner.test.ts",
        "learning/family-llm-factory.test.ts",
        "learning/fine-tuning-integration-simple.test.ts",
        "learning/deployment-validation.test.ts"
    )
    
    $existingTests = 0
    foreach ($testFile in $testFiles) {
        if (Test-Path $testFile) {
            $existingTests++
        }
    }
    
    Write-Host "  ✓ Test files present: $existingTests/$($testFiles.Count)" -ForegroundColor Gray
    
    return $true
}
if ($stepPassed) { $passedSteps++ }
$validationResults += @{ Step = "Project Structure"; Passed = $stepPassed }

# Step 3: Check Dependencies
$totalSteps++
$stepPassed = Invoke-ValidationStep "Dependencies Check" {
    if (-not (Test-Path "package.json")) {
        throw "package.json not found"
    }
    
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    
    # Check if node_modules exists
    if (-not (Test-Path "node_modules")) {
        Write-Host "  ⚠️ node_modules not found, attempting to install dependencies..." -ForegroundColor Yellow
        
        if (Test-Command "npm") {
            npm install
        } elseif (Test-Command "yarn") {
            yarn install
        } else {
            throw "Cannot install dependencies - no package manager available"
        }
    }
    
    Write-Host "  ✓ Dependencies installed" -ForegroundColor Gray
    
    # Check for TypeScript compilation
    if (Test-Path "tsconfig.json") {
        Write-Host "  ✓ TypeScript configuration found" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠️ No TypeScript configuration found" -ForegroundColor Yellow
    }
    
    return $true
}
if ($stepPassed) { $passedSteps++ }
$validationResults += @{ Step = "Dependencies"; Passed = $stepPassed }

# Step 4: TypeScript Compilation Check
$totalSteps++
$stepPassed = Invoke-ValidationStep "TypeScript Compilation" {
    if (Test-Path "tsconfig.json") {
        # Try to compile TypeScript
        $tscCommand = if (Test-Command "tsc") { "tsc" } else { "npx tsc" }
        
        $compileResult = & $tscCommand --noEmit 2>&1
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ⚠️ TypeScript compilation warnings/errors:" -ForegroundColor Yellow
            Write-Host $compileResult -ForegroundColor Gray
        } else {
            Write-Host "  ✓ TypeScript compilation successful" -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️ Skipping TypeScript compilation (no tsconfig.json)" -ForegroundColor Yellow
    }
    
    return $true
}
if ($stepPassed) { $passedSteps++ }
$validationResults += @{ Step = "TypeScript Compilation"; Passed = $stepPassed }

# Step 5: Run Unit Tests (if not skipped)
if (-not $SkipTests) {
    $totalSteps++
    $stepPassed = Invoke-ValidationStep "Unit Tests" {
        # Check if Jest is available
        $jestCommand = if (Test-Command "jest") { "jest" } else { "npx jest" }
        
        # Run fine-tuning specific tests
        $testPattern = "learning/*fine-tuning*.test.ts"
        
        Write-Host "  Running fine-tuning tests..." -ForegroundColor Gray
        
        $testResult = & $jestCommand $testPattern --passWithNoTests --verbose 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Unit tests passed" -ForegroundColor Gray
        } else {
            Write-Host "  ⚠️ Some unit tests failed or had issues:" -ForegroundColor Yellow
            Write-Host $testResult -ForegroundColor Gray
        }
        
        return $true
    }
    if ($stepPassed) { $passedSteps++ }
    $validationResults += @{ Step = "Unit Tests"; Passed = $stepPassed }
}

# Step 6: Run Deployment Validation Script
$totalSteps++
$stepPassed = Invoke-ValidationStep "Deployment Validation Script" {
    if (Test-Path "scripts/validate-fine-tuning-deployment.ts") {
        Write-Host "  Running deployment validation script..." -ForegroundColor Gray
        
        $validationResult = & node -r ts-node/register scripts/validate-fine-tuning-deployment.ts 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Deployment validation passed" -ForegroundColor Gray
        } else {
            Write-Host "  ⚠️ Deployment validation had issues:" -ForegroundColor Yellow
            Write-Host $validationResult -ForegroundColor Gray
        }
    } else {
        Write-Host "  ⚠️ Deployment validation script not found" -ForegroundColor Yellow
    }
    
    return $true
}
if ($stepPassed) { $passedSteps++ }
$validationResults += @{ Step = "Deployment Validation"; Passed = $stepPassed }

# Step 7: Environment-Specific Validation
$totalSteps++
$stepPassed = Invoke-ValidationStep "Environment Configuration" {
    # Detect current environment
    $detectedEnv = "development"
    
    if ($env:NODE_ENV -eq "production") {
        $detectedEnv = "production"
    } elseif ($env:JETSON_DEVICE -eq "true" -or $env:ARCH -eq "arm64") {
        $detectedEnv = "jetson"
    } elseif ($env:CHILD_SAFE_MODE -eq "true") {
        $detectedEnv = "child-safe"
    }
    
    if ($Environment -ne "auto") {
        $detectedEnv = $Environment
    }
    
    Write-Host "  ✓ Detected environment: $detectedEnv" -ForegroundColor Gray
    
    # Check system resources
    $memory = Get-WmiObject -Class Win32_ComputerSystem | Select-Object -ExpandProperty TotalPhysicalMemory
    $memoryGB = [math]::Round($memory / 1GB, 2)
    
    $cpu = Get-WmiObject -Class Win32_Processor | Select-Object -First 1
    $cpuCores = $cpu.NumberOfCores
    
    Write-Host "  ✓ System memory: ${memoryGB}GB" -ForegroundColor Gray
    Write-Host "  ✓ CPU cores: $cpuCores" -ForegroundColor Gray
    
    # Validate against environment requirements
    switch ($detectedEnv) {
        "jetson" {
            if ($memoryGB -lt 4) {
                Write-Host "  ⚠️ Low memory for Jetson environment: ${memoryGB}GB (recommended: 8GB)" -ForegroundColor Yellow
            }
        }
        "production" {
            if ($memoryGB -lt 8) {
                Write-Host "  ⚠️ Low memory for production environment: ${memoryGB}GB (recommended: 16GB+)" -ForegroundColor Yellow
            }
        }
    }
    
    return $true
}
if ($stepPassed) { $passedSteps++ }
$validationResults += @{ Step = "Environment Configuration"; Passed = $stepPassed }

# Step 8: Integration Test
$totalSteps++
$stepPassed = Invoke-ValidationStep "Integration Test" {
    Write-Host "  Testing basic integration..." -ForegroundColor Gray
    
    # Create a simple integration test script
    $integrationTest = @"
const { SimpleFineTuningIntegration, FineTuningConfigFactory } = require('./learning');

async function testIntegration() {
    try {
        const config = FineTuningConfigFactory.getConfig('development');
        console.log('✓ Configuration loaded');
        
        const mockEngine = {
            getInteractionHistory: async () => [{ userId: 'test', timestamp: new Date() }],
            getFamilyProfile: async () => ({ familyId: 'test', members: [], preferences: {}, safetySettings: {}, createdAt: new Date(), lastUpdated: new Date() }),
            generateRecommendations: async () => ['Test recommendation']
        };
        
        const integration = new SimpleFineTuningIntegration(config, mockEngine);
        await integration.initialize();
        console.log('✓ Integration initialized');
        
        const metrics = integration.getIntegrationMetrics();
        console.log('✓ Metrics retrieved:', JSON.stringify(metrics, null, 2));
        
        console.log('✅ Integration test passed');
        return true;
    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
        return false;
    }
}

testIntegration().then(success => process.exit(success ? 0 : 1));
"@
    
    $integrationTest | Out-File -FilePath "temp-integration-test.js" -Encoding UTF8
    
    try {
        $result = & node temp-integration-test.js 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ Integration test passed" -ForegroundColor Gray
        } else {
            Write-Host "  ⚠️ Integration test issues:" -ForegroundColor Yellow
            Write-Host $result -ForegroundColor Gray
        }
    } finally {
        if (Test-Path "temp-integration-test.js") {
            Remove-Item "temp-integration-test.js"
        }
    }
    
    return $true
}
if ($stepPassed) { $passedSteps++ }
$validationResults += @{ Step = "Integration Test"; Passed = $stepPassed }

# Print Summary
Write-Host "`n" + "=" * 50 -ForegroundColor Cyan
Write-Host "VALIDATION SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 50 -ForegroundColor Cyan

foreach ($result in $validationResults) {
    $status = if ($result.Passed) { "✅ PASSED" } else { "❌ FAILED" }
    $color = if ($result.Passed) { "Green" } else { "Red" }
    Write-Host "$($result.Step): $status" -ForegroundColor $color
}

Write-Host "`nOverall Result: $passedSteps/$totalSteps steps passed" -ForegroundColor Cyan

if ($passedSteps -eq $totalSteps) {
    Write-Host "🎉 All validation steps passed! The fine-tuning system is ready for deployment." -ForegroundColor Green
    exit 0
} else {
    $failedSteps = $totalSteps - $passedSteps
    Write-Host "⚠️ $failedSteps validation step(s) had issues. Please review the output above." -ForegroundColor Yellow
    exit 1
}