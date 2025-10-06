# PowerShell script to make deployment scripts executable on Jetson
# Run this after transferring files to Jetson

param(
    [string]$JetsonHost = "jetson-nano.local",
    [string]$JetsonUser = "jetson"
)

Write-Host "Making deployment scripts executable on Jetson..." -ForegroundColor Blue

# Make scripts executable via SSH
$scripts = @(
    "deployment/jetson-setup.sh",
    "deployment/download-models.sh",
    "deployment/deploy-jetson.sh"
)

foreach ($script in $scripts) {
    Write-Host "Making $script executable..." -ForegroundColor Yellow
    ssh "$JetsonUser@$JetsonHost" "chmod +x $script"
}

Write-Host "All scripts are now executable!" -ForegroundColor Green