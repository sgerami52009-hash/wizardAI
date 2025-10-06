# Basic GitHub Repository Initialization Script
param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubUsername,
    [string]$RepositoryName = "jetson-home-assistant"
)

Write-Host "Initializing GitHub repository..." -ForegroundColor Green
Write-Host "Username: $GitHubUsername" -ForegroundColor Yellow
Write-Host "Repository: $RepositoryName" -ForegroundColor Yellow

# Check Git installation
try {
    git --version | Out-Null
    Write-Host "Git is available" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Git is not installed" -ForegroundColor Red
    Write-Host "Please install Git from: https://git-scm.com/" -ForegroundColor Yellow
    exit 1
}

# Initialize repository
if (-not (Test-Path ".git")) {
    Write-Host "Initializing Git repository..." -ForegroundColor Cyan
    git init
    Write-Host "Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "Git repository already exists" -ForegroundColor Green
}

# Add files
Write-Host "Adding files to repository..." -ForegroundColor Cyan
git add .

# Create initial commit
try {
    git log --oneline -1 | Out-Null
    Write-Host "Repository already has commits" -ForegroundColor Green
} catch {
    Write-Host "Creating initial commit..." -ForegroundColor Cyan
    git commit -m "Initial commit: Jetson Home Assistant project setup"
    Write-Host "Initial commit created" -ForegroundColor Green
}

# Set main branch
Write-Host "Setting main branch..." -ForegroundColor Cyan
git branch -M main

# Add remote
$remoteUrl = "https://github.com/$GitHubUsername/$RepositoryName.git"
try {
    git remote get-url origin | Out-Null
    Write-Host "Remote origin already exists" -ForegroundColor Green
} catch {
    Write-Host "Adding remote origin..." -ForegroundColor Cyan
    git remote add origin $remoteUrl
    Write-Host "Remote origin added" -ForegroundColor Green
}

Write-Host ""
Write-Host "MANUAL STEPS REQUIRED:" -ForegroundColor Yellow
Write-Host "1. Go to https://github.com/new" -ForegroundColor White
Write-Host "2. Repository name: $RepositoryName" -ForegroundColor White
Write-Host "3. Make it PUBLIC (recommended)" -ForegroundColor White
Write-Host "4. Do NOT add README, .gitignore, or license" -ForegroundColor White
Write-Host "5. Click 'Create repository'" -ForegroundColor White
Write-Host ""
Write-Host "After creating the repository, run:" -ForegroundColor Yellow
Write-Host "git push -u origin main" -ForegroundColor White
Write-Host ""
Write-Host "Repository URL will be:" -ForegroundColor Cyan
Write-Host $remoteUrl -ForegroundColor White