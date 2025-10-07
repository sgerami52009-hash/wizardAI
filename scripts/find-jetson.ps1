# Script to find Jetson devices on the network
param(
    [string]$NetworkRange = "192.168.1"
)

Write-Host "🔍 Searching for Jetson devices on network..." -ForegroundColor Cyan
Write-Host "Network range: $NetworkRange.0/24" -ForegroundColor Yellow

# Function to test if a host is reachable
function Test-JetsonHost {
    param([string]$HostIP)
    
    try {
        $ping = Test-Connection -ComputerName $HostIP -Count 1 -Quiet -TimeoutSeconds 2
        if ($ping) {
            # Try to get hostname
            try {
                $hostname = [System.Net.Dns]::GetHostEntry($HostIP).HostName
                return @{
                    IP = $HostIP
                    Hostname = $hostname
                    Reachable = $true
                }
            } catch {
                return @{
                    IP = $HostIP
                    Hostname = "Unknown"
                    Reachable = $true
                }
            }
        }
    } catch {
        return $null
    }
    return $null
}

# Scan network range
$foundDevices = @()
Write-Host "Scanning network range ${NetworkRange}.1-254..." -ForegroundColor Yellow

for ($i = 1; $i -le 254; $i++) {
    $ip = "$NetworkRange.$i"
    Write-Progress -Activity "Scanning Network" -Status "Checking $ip" -PercentComplete (($i / 254) * 100)
    
    $result = Test-JetsonHost -HostIP $ip
    if ($result) {
        $foundDevices += $result
        Write-Host "Found device: $($result.IP) ($($result.Hostname))" -ForegroundColor Green
    }
}

Write-Progress -Activity "Scanning Network" -Completed

# Display results
Write-Host "`n📋 Network Scan Results:" -ForegroundColor Blue
Write-Host "========================" -ForegroundColor Blue

if ($foundDevices.Count -eq 0) {
    Write-Host "❌ No devices found on network ${NetworkRange}.0/24" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting suggestions:" -ForegroundColor Yellow
    Write-Host "1. Make sure your Jetson is powered on" -ForegroundColor White
    Write-Host "2. Check network connection (Ethernet/WiFi)" -ForegroundColor White
    Write-Host "3. Try a different network range:" -ForegroundColor White
    Write-Host "   .\scripts\find-jetson.ps1 -NetworkRange '192.168.0'" -ForegroundColor Gray
    Write-Host "   .\scripts\find-jetson.ps1 -NetworkRange '10.0.0'" -ForegroundColor Gray
} else {
    Write-Host "✅ Found $($foundDevices.Count) device(s):" -ForegroundColor Green
    Write-Host ""
    
    foreach ($device in $foundDevices) {
        Write-Host "🖥️  IP: $($device.IP)" -ForegroundColor Cyan
        Write-Host "   Hostname: $($device.Hostname)" -ForegroundColor White
        
        # Check if it might be a Jetson
        if ($device.Hostname -match "jetson|nano|orin" -or $device.Hostname -eq "Unknown") {
            Write-Host "   ⭐ Possible Jetson device!" -ForegroundColor Yellow
        }
        Write-Host ""
    }
    
    Write-Host "🔧 To use a specific IP for deployment:" -ForegroundColor Blue
    Write-Host "export JETSON_HOST='192.168.1.XXX'" -ForegroundColor Gray
    Write-Host ".\deployment\deploy-jetson.sh" -ForegroundColor Gray
}

# Test specific Jetson hostnames
Write-Host "🔍 Testing common Jetson hostnames..." -ForegroundColor Cyan
$commonNames = @("jetson-nano.local", "jetson.local", "nano.local", "orin.local")

foreach ($name in $commonNames) {
    try {
        $ping = Test-Connection -ComputerName $name -Count 1 -Quiet -TimeoutSeconds 3
        if ($ping) {
            Write-Host "✅ $name is reachable!" -ForegroundColor Green
        } else {
            Write-Host "❌ $name is not reachable" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $name is not reachable" -ForegroundColor Red
    }
}

Write-Host "`n📚 Next Steps:" -ForegroundColor Blue
Write-Host "1. If you found your Jetson, use its IP address" -ForegroundColor White
Write-Host "2. If no Jetson found, check physical connections" -ForegroundColor White
Write-Host "3. Consider using USB deployment instead" -ForegroundColor White