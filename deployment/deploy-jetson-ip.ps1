# PowerShell deployment script for Jetson using IP address
param(
    [Parameter(Mandatory=$true)]
    [string]$JetsonIP,
    
    [string]$JetsonUser = "jetson",
    [string]$ProjectName = "jetson-home-assistant"
)

Write-Host "🚀 Deploying to Jetson Nano Orin" -ForegroundColor Cyan
Write-Host "Target: $JetsonUser@$JetsonIP" -ForegroundColor Yellow
Write-Host "Project: $ProjectName" -ForegroundColor Yellow

# Test connection first
Write-Host "🔍 Testing connection to Jetson..." -ForegroundColor Cyan
try {
    $ping = Test-Connection -ComputerName $JetsonIP -Count 2 -Quiet
    if (-not $ping) {
        Write-Host "❌ Cannot reach Jetson at $JetsonIP" -ForegroundColor Red
        Write-Host "Please check:" -ForegroundColor Yellow
        Write-Host "1. Jetson is powered on" -ForegroundColor White
        Write-Host "2. Network connection is working" -ForegroundColor White
        Write-Host "3. IP address is correct" -ForegroundColor White
        exit 1
    }
    Write-Host "✅ Jetson is reachable" -ForegroundColor Green
} catch {
    Write-Host "❌ Network error: $_" -ForegroundColor Red
    exit 1
}

# Test SSH connection
Write-Host "🔐 Testing SSH connection..." -ForegroundColor Cyan
try {
    $sshTest = ssh -o ConnectTimeout=10 -o BatchMode=yes "$JetsonUser@$JetsonIP" "echo 'SSH OK'" 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ SSH connection failed" -ForegroundColor Red
        Write-Host "Please ensure:" -ForegroundColor Yellow
        Write-Host "1. SSH is enabled on Jetson" -ForegroundColor White
        Write-Host "2. You have SSH keys set up or password access" -ForegroundColor White
        Write-Host "3. Username '$JetsonUser' is correct" -ForegroundColor White
        Write-Host ""
        Write-Host "To enable SSH on Jetson:" -ForegroundColor Cyan
        Write-Host "sudo systemctl enable ssh" -ForegroundColor Gray
        Write-Host "sudo systemctl start ssh" -ForegroundColor Gray
        exit 1
    }
    Write-Host "✅ SSH connection successful" -ForegroundColor Green
} catch {
    Write-Host "❌ SSH test failed: $_" -ForegroundColor Red
    exit 1
}

# Check if project files exist
if (-not (Test-Path "package.json")) {
    Write-Host "❌ package.json not found. Run from project root directory." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "dist/index.js")) {
    Write-Host "📦 Building project first..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed" -ForegroundColor Red
        exit 1
    }
}

# Create deployment package
Write-Host "📦 Creating deployment package..." -ForegroundColor Cyan
$tempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
$packageDir = Join-Path $tempDir $ProjectName

New-Item -ItemType Directory -Path $packageDir -Force | Out-Null

# Copy necessary files
Write-Host "📋 Copying files..." -ForegroundColor Yellow
Copy-Item -Path "dist" -Destination $packageDir -Recurse -Force
Copy-Item -Path "config" -Destination $packageDir -Recurse -Force
Copy-Item -Path "deployment" -Destination $packageDir -Recurse -Force
Copy-Item -Path "package*.json" -Destination $packageDir -Force

# Create archive
$archivePath = Join-Path $env:TEMP "$ProjectName-$(Get-Date -Format 'yyyyMMdd-HHmmss').tar.gz"
Write-Host "📦 Creating archive: $archivePath" -ForegroundColor Yellow

# Use tar if available, otherwise use PowerShell compression
try {
    tar -czf $archivePath -C $tempDir $ProjectName
    Write-Host "✅ Archive created with tar" -ForegroundColor Green
} catch {
    # Fallback to PowerShell compression
    Compress-Archive -Path $packageDir -DestinationPath ($archivePath -replace '\.tar\.gz$', '.zip') -Force
    $archivePath = $archivePath -replace '\.tar\.gz$', '.zip'
    Write-Host "✅ Archive created with PowerShell compression" -ForegroundColor Green
}

# Transfer to Jetson
Write-Host "📤 Transferring files to Jetson..." -ForegroundColor Cyan
$remoteDir = "/home/$JetsonUser/$ProjectName"

try {
    # Create remote directory
    ssh "$JetsonUser@$JetsonIP" "mkdir -p $remoteDir"
    
    # Transfer archive
    scp $archivePath "$JetsonUser@$JetsonIP:$remoteDir/"
    
    # Extract on Jetson
    $archiveFile = Split-Path $archivePath -Leaf
    if ($archivePath.EndsWith('.tar.gz')) {
        ssh "$JetsonUser@$JetsonIP" "cd $remoteDir && tar -xzf $archiveFile --strip-components=1"
    } else {
        ssh "$JetsonUser@$JetsonIP" "cd $remoteDir && unzip -o $archiveFile && mv $ProjectName/* . && rmdir $ProjectName"
    }
    
    # Set permissions
    ssh "$JetsonUser@$JetsonIP" "chmod +x $remoteDir/deployment/*.sh"
    
    Write-Host "✅ Files transferred successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ File transfer failed: $_" -ForegroundColor Red
    exit 1
}

# Run setup on Jetson
Write-Host "🔧 Running setup on Jetson..." -ForegroundColor Cyan
try {
    ssh "$JetsonUser@$JetsonIP" "cd $remoteDir && sudo ./deployment/jetson-setup.sh"
    Write-Host "✅ Jetson setup completed" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Setup may have encountered issues. Check manually." -ForegroundColor Yellow
}

# Download models
Write-Host "🤖 Setting up AI models..." -ForegroundColor Cyan
try {
    ssh "$JetsonUser@$JetsonIP" "cd $remoteDir && ./deployment/download-models.sh --placeholder"
    Write-Host "✅ Models configured" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Model setup may have encountered issues." -ForegroundColor Yellow
}

# Deploy with Docker
Write-Host "🐳 Deploying with Docker..." -ForegroundColor Cyan
try {
    ssh "$JetsonUser@$JetsonIP" "cd $remoteDir && docker-compose -f deployment/docker-compose.jetson.yml up -d"
    Write-Host "✅ Docker deployment completed" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Docker deployment may have encountered issues." -ForegroundColor Yellow
}

# Verify deployment
Write-Host "🔍 Verifying deployment..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

try {
    $healthCheck = ssh "$JetsonUser@$JetsonIP" "curl -f http://localhost:3000/health" 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Health check passed" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Health check failed - service may still be starting" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️ Could not verify health check" -ForegroundColor Yellow
}

# Cleanup
Remove-Item $tempDir -Recurse -Force
Remove-Item $archivePath -Force

Write-Host "`n🎉 Deployment completed!" -ForegroundColor Green
Write-Host "Access your Home Assistant at:" -ForegroundColor Blue
Write-Host "  Web Interface: http://$JetsonIP:8080" -ForegroundColor Cyan
Write-Host "  API Endpoint: http://$JetsonIP:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "To monitor:" -ForegroundColor Blue
Write-Host "  ssh $JetsonUser@$JetsonIP" -ForegroundColor Gray
Write-Host "  docker logs -f jetson-home-assistant" -ForegroundColor Gray