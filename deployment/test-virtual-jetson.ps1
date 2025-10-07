# Virtual Jetson Testing Script
# This script sets up and tests the Home Assistant in a virtual Jetson environment

param(
    [switch]$Build = $false,
    [switch]$Deploy = $false,
    [switch]$Test = $false,
    [switch]$Monitor = $false,
    [switch]$Cleanup = $false,
    [switch]$All = $false
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Virtual Jetson Nano Testing Environment" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

if ($All) {
    $Build = $true
    $Deploy = $true
    $Test = $true
    $Monitor = $true
}

# Build the application
if ($Build) {
    Write-Host "🔨 Building application..." -ForegroundColor Yellow
    
    # Install dependencies
    npm ci
    
    # Run tests
    Write-Host "Running tests..." -ForegroundColor Gray
    npm test
    
    # Build application
    Write-Host "Building TypeScript..." -ForegroundColor Gray
    npm run build
    
    # Verify build
    if (-not (Test-Path "dist/index.js")) {
        Write-Host "❌ Build failed - dist/index.js not found" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Application built successfully" -ForegroundColor Green
}

# Deploy to virtual Jetson
if ($Deploy) {
    Write-Host "🐳 Deploying to virtual Jetson environment..." -ForegroundColor Yellow
    
    # Stop existing containers
    Write-Host "Stopping existing containers..." -ForegroundColor Gray
    docker-compose -f deployment/docker-compose.virtual-jetson.yml down 2>$null
    
    # Build and start virtual Jetson
    Write-Host "Building virtual Jetson container..." -ForegroundColor Gray
    docker-compose -f deployment/docker-compose.virtual-jetson.yml build
    
    Write-Host "Starting virtual Jetson environment..." -ForegroundColor Gray
    docker-compose -f deployment/docker-compose.virtual-jetson.yml up -d
    
    # Wait for services to start
    Write-Host "Waiting for services to start..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
    
    # Check container status
    $containers = docker-compose -f deployment/docker-compose.virtual-jetson.yml ps
    Write-Host "Container status:" -ForegroundColor Gray
    Write-Host $containers
    
    Write-Host "✅ Virtual Jetson environment deployed" -ForegroundColor Green
}

# Test the deployment
if ($Test) {
    Write-Host "🧪 Testing virtual Jetson deployment..." -ForegroundColor Yellow
    
    # Test API endpoint
    Write-Host "Testing API endpoint..." -ForegroundColor Gray
    try {
        $healthResponse = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 10
        Write-Host "✅ API Health Check: $($healthResponse.status)" -ForegroundColor Green
    } catch {
        Write-Host "❌ API Health Check failed: $_" -ForegroundColor Red
    }
    
    # Test web interface
    Write-Host "Testing web interface..." -ForegroundColor Gray
    try {
        $webResponse = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 10
        if ($webResponse.StatusCode -eq 200) {
            Write-Host "✅ Web Interface: Accessible" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ Web Interface failed: $_" -ForegroundColor Red
    }
    
    # Test SSH access to virtual Jetson
    Write-Host "Testing SSH access..." -ForegroundColor Gray
    try {
        $sshTest = ssh -o ConnectTimeout=5 -o BatchMode=yes jetson@localhost -p 22 "echo 'SSH OK'" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ SSH Access: Working" -ForegroundColor Green
        } else {
            Write-Host "⚠️ SSH Access: Not configured (use password 'jetson')" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "⚠️ SSH Access: Not available" -ForegroundColor Yellow
    }
    
    # Test container health
    Write-Host "Testing container health..." -ForegroundColor Gray
    $containerHealth = docker inspect virtual-jetson-nano --format='{{.State.Health.Status}}' 2>$null
    if ($containerHealth -eq "healthy") {
        Write-Host "✅ Container Health: Healthy" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Container Health: $containerHealth" -ForegroundColor Yellow
    }
    
    # Test Jetson-specific features
    Write-Host "Testing Jetson simulation features..." -ForegroundColor Gray
    try {
        $jetsonInfo = docker exec virtual-jetson-nano cat /etc/nv_tegra_release 2>$null
        if ($jetsonInfo) {
            Write-Host "✅ Jetson Simulation: Active" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️ Jetson Simulation: Limited" -ForegroundColor Yellow
    }
    
    Write-Host "✅ Testing completed" -ForegroundColor Green
}

# Monitor the virtual Jetson
if ($Monitor) {
    Write-Host "📊 Monitoring virtual Jetson..." -ForegroundColor Yellow
    
    # Show container stats
    Write-Host "Container Resource Usage:" -ForegroundColor Gray
    docker stats virtual-jetson-nano --no-stream
    
    # Show application logs
    Write-Host "`nApplication Logs (last 20 lines):" -ForegroundColor Gray
    docker logs virtual-jetson-nano --tail 20
    
    # Show health status
    Write-Host "`nHealth Status:" -ForegroundColor Gray
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
        $health | ConvertTo-Json -Depth 3
    } catch {
        Write-Host "Health check not available" -ForegroundColor Red
    }
    
    # Show system status from inside container
    Write-Host "`nVirtual Jetson System Status:" -ForegroundColor Gray
    docker exec virtual-jetson-nano /app/jetson-health.sh
}

# Cleanup
if ($Cleanup) {
    Write-Host "🧹 Cleaning up virtual Jetson environment..." -ForegroundColor Yellow
    
    # Stop and remove containers
    docker-compose -f deployment/docker-compose.virtual-jetson.yml down -v
    
    # Remove images
    docker rmi $(docker images -q "*virtual-jetson*") 2>$null
    
    Write-Host "✅ Cleanup completed" -ForegroundColor Green
}

# Display access information
if ($Deploy -or $All) {
    Write-Host "`n🌐 Access Information:" -ForegroundColor Blue
    Write-Host "=====================" -ForegroundColor Blue
    Write-Host "Web Interface: http://localhost:8080" -ForegroundColor Cyan
    Write-Host "API Endpoint:  http://localhost:3000" -ForegroundColor Cyan
    Write-Host "Health Check:  http://localhost:3000/health" -ForegroundColor Cyan
    Write-Host "SSH Access:    ssh jetson@localhost (password: jetson)" -ForegroundColor Cyan
    Write-Host "Monitoring:    http://localhost:9090 (Prometheus)" -ForegroundColor Cyan
    
    Write-Host "`n📋 Useful Commands:" -ForegroundColor Blue
    Write-Host "View logs:     docker logs -f virtual-jetson-nano" -ForegroundColor Gray
    Write-Host "Enter shell:   docker exec -it virtual-jetson-nano bash" -ForegroundColor Gray
    Write-Host "Health check:  docker exec virtual-jetson-nano /app/jetson-health.sh" -ForegroundColor Gray
    Write-Host "Stop:          docker-compose -f deployment/docker-compose.virtual-jetson.yml down" -ForegroundColor Gray
}

Write-Host "`n🎉 Virtual Jetson testing environment ready!" -ForegroundColor Green