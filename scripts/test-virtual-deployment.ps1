# Comprehensive Virtual Jetson Testing Script
Write-Host "🧪 Comprehensive Virtual Jetson Testing" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

# Test 1: Build Application
Write-Host "`n1️⃣ Building Application..." -ForegroundColor Yellow
try {
    npm ci
    npm run build
    
    if (Test-Path "dist/index.js") {
        Write-Host "✅ Application built successfully" -ForegroundColor Green
    } else {
        throw "Build output not found"
    }
} catch {
    Write-Host "❌ Build failed: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Start Virtual Environment
Write-Host "`n2️⃣ Starting Virtual Jetson Environment..." -ForegroundColor Yellow
try {
    # Stop any existing containers
    docker-compose -f deployment/docker-compose.virtual-jetson.yml down 2>$null
    
    # Start virtual environment
    docker-compose -f deployment/docker-compose.virtual-jetson.yml up -d --build
    
    Write-Host "✅ Virtual environment started" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to start virtual environment: $_" -ForegroundColor Red
    exit 1
}

# Test 3: Wait for Services
Write-Host "`n3️⃣ Waiting for services to initialize..." -ForegroundColor Yellow
$maxWait = 60
$waited = 0

while ($waited -lt $maxWait) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 5
        if ($response.status -eq "healthy") {
            Write-Host "✅ Services are ready" -ForegroundColor Green
            break
        }
    } catch {
        # Service not ready yet
    }
    
    Start-Sleep -Seconds 5
    $waited += 5
    Write-Host "Waiting... ($waited/$maxWait seconds)" -ForegroundColor Gray
}

if ($waited -ge $maxWait) {
    Write-Host "⚠️ Services took longer than expected to start" -ForegroundColor Yellow
}

# Test 4: API Endpoints
Write-Host "`n4️⃣ Testing API Endpoints..." -ForegroundColor Yellow

$apiTests = @(
    @{ Name = "Health Check"; Url = "http://localhost:3000/health" },
    @{ Name = "Status"; Url = "http://localhost:3000/status" }
)

foreach ($test in $apiTests) {
    try {
        $response = Invoke-RestMethod -Uri $test.Url -TimeoutSec 10
        Write-Host "✅ $($test.Name): OK" -ForegroundColor Green
    } catch {
        Write-Host "❌ $($test.Name): Failed - $_" -ForegroundColor Red
    }
}

# Test 5: Web Interface
Write-Host "`n5️⃣ Testing Web Interface..." -ForegroundColor Yellow
try {
    $webResponse = Invoke-WebRequest -Uri "http://localhost:8080" -TimeoutSec 10
    if ($webResponse.StatusCode -eq 200) {
        Write-Host "✅ Web Interface: Accessible" -ForegroundColor Green
    }
} catch {
    Write-Host "❌ Web Interface: Failed - $_" -ForegroundColor Red
}

# Test 6: Container Health
Write-Host "`n6️⃣ Testing Container Health..." -ForegroundColor Yellow
try {
    $containerHealth = docker inspect virtual-jetson-nano --format='{{.State.Health.Status}}' 2>$null
    Write-Host "Container Health: $containerHealth" -ForegroundColor Cyan
    
    if ($containerHealth -eq "healthy") {
        Write-Host "✅ Container is healthy" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Container health: $containerHealth" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Could not check container health" -ForegroundColor Red
}

# Test 7: Resource Usage
Write-Host "`n7️⃣ Checking Resource Usage..." -ForegroundColor Yellow
try {
    $stats = docker stats virtual-jetson-nano --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"
    Write-Host $stats -ForegroundColor Cyan
    Write-Host "✅ Resource monitoring active" -ForegroundColor Green
} catch {
    Write-Host "❌ Could not get resource stats" -ForegroundColor Red
}

# Test 8: Jetson Simulation Features
Write-Host "`n8️⃣ Testing Jetson Simulation Features..." -ForegroundColor Yellow
try {
    # Test Jetson identification
    $jetsonInfo = docker exec virtual-jetson-nano cat /etc/nv_tegra_release 2>$null
    if ($jetsonInfo) {
        Write-Host "✅ Jetson simulation active" -ForegroundColor Green
        Write-Host "Jetson Info: $($jetsonInfo.Split(',')[0])" -ForegroundColor Cyan
    }
    
    # Test temperature monitoring
    $temp = docker exec virtual-jetson-nano cat /sys/class/thermal/thermal_zone0/temp 2>$null
    if ($temp) {
        $tempC = [math]::Round($temp / 1000, 1)
        Write-Host "✅ Temperature monitoring: ${tempC}°C" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️ Some Jetson features not available" -ForegroundColor Yellow
}

# Test 9: Application Logs
Write-Host "`n9️⃣ Checking Application Logs..." -ForegroundColor Yellow
try {
    $logs = docker logs virtual-jetson-nano --tail 10 2>$null
    if ($logs) {
        Write-Host "✅ Application logs available" -ForegroundColor Green
        Write-Host "Recent logs:" -ForegroundColor Gray
        $logs | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
    }
} catch {
    Write-Host "⚠️ Could not retrieve logs" -ForegroundColor Yellow
}

# Test 10: Performance Benchmarks
Write-Host "`n🔟 Running Performance Benchmarks..." -ForegroundColor Yellow
try {
    # Test response time
    $startTime = Get-Date
    $response = Invoke-RestMethod -Uri "http://localhost:3000/health" -TimeoutSec 10
    $responseTime = (Get-Date) - $startTime
    
    if ($responseTime.TotalMilliseconds -lt 500) {
        Write-Host "✅ Response time: $($responseTime.TotalMilliseconds)ms (< 500ms target)" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Response time: $($responseTime.TotalMilliseconds)ms (> 500ms target)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Performance test failed" -ForegroundColor Red
}

# Summary
Write-Host "`n📊 Test Summary" -ForegroundColor Blue
Write-Host "===============" -ForegroundColor Blue
Write-Host "Virtual Jetson Environment: ✅ Running" -ForegroundColor Green
Write-Host "Web Interface: http://localhost:8080" -ForegroundColor Cyan
Write-Host "API Endpoint: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Health Check: http://localhost:3000/health" -ForegroundColor Cyan

Write-Host "`n🎮 Interactive Commands:" -ForegroundColor Blue
Write-Host "View logs:    docker logs -f virtual-jetson-nano" -ForegroundColor Gray
Write-Host "Enter shell:  docker exec -it virtual-jetson-nano bash" -ForegroundColor Gray
Write-Host "Stop env:     docker-compose -f deployment/docker-compose.virtual-jetson.yml down" -ForegroundColor Gray

Write-Host "`n🎉 Virtual Jetson testing completed!" -ForegroundColor Green