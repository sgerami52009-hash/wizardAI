# Simple Jetson discovery script
Write-Host "Looking for Jetson devices..." -ForegroundColor Cyan

# Test common Jetson hostnames
$jetsonNames = @("jetson-nano.local", "jetson.local", "nano.local", "orin.local")

Write-Host "Testing common Jetson hostnames..." -ForegroundColor Yellow
foreach ($name in $jetsonNames) {
    Write-Host "Testing $name..." -ForegroundColor Gray
    try {
        $result = Test-Connection -ComputerName $name -Count 1 -Quiet -TimeoutSeconds 3
        if ($result) {
            Write-Host "✅ Found Jetson at: $name" -ForegroundColor Green
            Write-Host "Use this for deployment:" -ForegroundColor Cyan
            Write-Host "`$env:JETSON_HOST = '$name'" -ForegroundColor White
            Write-Host ".\deployment\deploy-jetson.sh" -ForegroundColor White
            exit 0
        } else {
            Write-Host "❌ $name not reachable" -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ $name not reachable" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "No Jetson found with common hostnames." -ForegroundColor Yellow
Write-Host ""
Write-Host "Manual steps to find your Jetson:" -ForegroundColor Cyan
Write-Host "1. Check your router's admin panel for connected devices" -ForegroundColor White
Write-Host "2. Look for devices named 'jetson', 'nano', or 'orin'" -ForegroundColor White
Write-Host "3. Try connecting directly via Ethernet" -ForegroundColor White
Write-Host "4. Use the IP address directly:" -ForegroundColor White
Write-Host "   .\deployment\deploy-jetson-ip.ps1 -JetsonIP '192.168.1.XXX'" -ForegroundColor Gray
Write-Host ""
Write-Host "Alternative: Use USB deployment" -ForegroundColor Cyan
Write-Host ".\deployment\create-usb-installer.ps1 -UsbDrive E:" -ForegroundColor Gray