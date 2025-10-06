# PowerShell script to verify deployment readiness
# Run this before deploying to Jetson

Write-Host "🔍 Verifying deployment readiness..." -ForegroundColor Blue

$errors = @()
$warnings = @()

# Check required files
$requiredFiles = @(
    "deployment/Dockerfile.jetson",
    "deployment/docker-compose.jetson.yml",
    "deployment/deploy-jetson.sh",
    "deployment/jetson-setup.sh",
    "deployment/download-models.sh",
    "config/production.json",
    "dist/index.js",
    "dist/health-check.js",
    "package.json"
)

Write-Host "📁 Checking required files..." -ForegroundColor Yellow
foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file" -ForegroundColor Red
        $errors += "Missing file: $file"
    }
}

# Check package.json
if (Test-Path "package.json") {
    Write-Host "📦 Checking package.json..." -ForegroundColor Yellow
    try {
        $package = Get-Content "package.json" | ConvertFrom-Json
        if ($package.scripts.build) {
            Write-Host "  ✅ Build script found" -ForegroundColor Green
        } else {
            $warnings += "No build script in package.json"
        }
        
        if ($package.engines.node) {
            Write-Host "  ✅ Node.js version specified: $($package.engines.node)" -ForegroundColor Green
        } else {
            $warnings += "No Node.js version specified in package.json"
        }
    } catch {
        $errors += "Invalid package.json format"
    }
}

# Check if built
if (Test-Path "dist/index.js") {
    Write-Host "🏗️ Checking build output..." -ForegroundColor Yellow
    $indexSize = (Get-Item "dist/index.js").Length
    if ($indexSize -gt 1000) {
        Write-Host "  ✅ dist/index.js looks good ($indexSize bytes)" -ForegroundColor Green
    } else {
        $warnings += "dist/index.js seems too small ($indexSize bytes)"
    }
}

# Check configuration
if (Test-Path "config/production.json") {
    Write-Host "⚙️ Checking production config..." -ForegroundColor Yellow
    try {
        $config = Get-Content "config/production.json" | ConvertFrom-Json
        if ($config.jetson) {
            Write-Host "  ✅ Jetson configuration found" -ForegroundColor Green
        } else {
            $warnings += "No Jetson-specific configuration found"
        }
        
        if ($config.safety.child_safety_enabled) {
            Write-Host "  ✅ Child safety enabled" -ForegroundColor Green
        } else {
            $warnings += "Child safety not explicitly enabled"
        }
    } catch {
        $errors += "Invalid production.json format"
    }
}

# Check Docker files
if (Test-Path "deployment/Dockerfile.jetson") {
    Write-Host "🐳 Checking Docker configuration..." -ForegroundColor Yellow
    $dockerfile = Get-Content "deployment/Dockerfile.jetson" -Raw
    if ($dockerfile -match "nvcr.io/nvidia/l4t-base") {
        Write-Host "  ✅ Using NVIDIA L4T base image" -ForegroundColor Green
    } else {
        $warnings += "Not using NVIDIA L4T base image"
    }
}

# Summary
Write-Host "`n📊 Verification Summary:" -ForegroundColor Blue
Write-Host "======================" -ForegroundColor Blue

if ($errors.Count -eq 0) {
    Write-Host "✅ No critical errors found!" -ForegroundColor Green
} else {
    Write-Host "❌ Critical errors found:" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  • $error" -ForegroundColor Red
    }
}

if ($warnings.Count -eq 0) {
    Write-Host "✅ No warnings!" -ForegroundColor Green
} else {
    Write-Host "⚠️ Warnings:" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  • $warning" -ForegroundColor Yellow
    }
}

# Next steps
if ($errors.Count -eq 0) {
    Write-Host "`n🚀 Ready for deployment!" -ForegroundColor Green
    Write-Host "Next steps:" -ForegroundColor Blue
    Write-Host "1. Set environment variables:" -ForegroundColor White
    Write-Host "   `$env:JETSON_HOST = 'jetson-nano.local'" -ForegroundColor Gray
    Write-Host "   `$env:JETSON_USER = 'jetson'" -ForegroundColor Gray
    Write-Host "2. Run deployment:" -ForegroundColor White
    Write-Host "   cd deployment" -ForegroundColor Gray
    Write-Host "   bash deploy-jetson.sh" -ForegroundColor Gray
} else {
    Write-Host "`n❌ Please fix the errors before deploying" -ForegroundColor Red
    exit 1
}

Write-Host "`n📚 For detailed instructions, see deployment/README.md" -ForegroundColor Cyan