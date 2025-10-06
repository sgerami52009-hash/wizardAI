# Simple GitHub Repository Setup Script
# This script helps initialize the GitHub repository for Jetson Home Assistant

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubUsername,
    
    [string]$RepositoryName = "jetson-home-assistant",
    [switch]$CreateRepo = $false,
    [switch]$Private = $false,
    [string]$Description = "Family-friendly AI assistant for NVIDIA Jetson Nano Orin with voice interaction and customizable avatars"
)

Write-Host "Setting up GitHub repository for Jetson Home Assistant" -ForegroundColor Cyan
Write-Host "Repository: $GitHubUsername/$RepositoryName" -ForegroundColor Yellow

# Check if Git is installed
try {
    git --version | Out-Null
    Write-Host "Git is installed" -ForegroundColor Green
}
catch {
    Write-Host "Git is not installed. Please install Git first." -ForegroundColor Red
    Write-Host "Download from: https://git-scm.com/download/windows" -ForegroundColor Yellow
    exit 1
}

# Check if GitHub CLI is available
$hasGitHubCLI = $false
try {
    gh --version | Out-Null
    $hasGitHubCLI = $true
    Write-Host "GitHub CLI is available" -ForegroundColor Green
}
catch {
    Write-Host "GitHub CLI not found. Repository creation will be manual." -ForegroundColor Yellow
    if ($CreateRepo) {
        Write-Host "Install GitHub CLI from: https://cli.github.com/" -ForegroundColor Yellow
    }
}

# Initialize git repository if not already initialized
if (-not (Test-Path ".git")) {
    Write-Host "Initializing Git repository..." -ForegroundColor Cyan
    git init
    Write-Host "Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "Git repository already exists" -ForegroundColor Green
}

# Check for required files
$requiredFiles = @("README.md", "package.json", "CONTRIBUTING.md", "LICENSE", "CHANGELOG.md")
$missingFiles = @()

foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "Missing required files:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "  - $file" -ForegroundColor Red
    }
    exit 1
}
Write-Host "All required files present" -ForegroundColor Green

# Add files to git
Write-Host "Adding files to Git..." -ForegroundColor Cyan
git add .

# Create initial commit if needed
$hasCommits = $false
try {
    git log --oneline -1 | Out-Null
    $hasCommits = $true
    Write-Host "Repository already has commits" -ForegroundColor Green
}
catch {
    Write-Host "Creating initial commit..." -ForegroundColor Cyan
    git commit -m "feat: initial project setup with comprehensive Jetson Home Assistant

- Add voice interaction pipeline with wake word detection
- Add avatar system with 3D rendering and lip-sync
- Add child safety compliance system with content filtering
- Add smart scheduling with family calendar integration
- Add personalized recommendations with privacy protection
- Add Jetson Nano Orin deployment system with Docker
- Add USB installer for offline deployment
- Add comprehensive testing suite with safety validation
- Add performance monitoring and resource management
- Add parental controls with activity logging"
    
    Write-Host "Initial commit created" -ForegroundColor Green
}

# Create GitHub repository if requested and CLI is available
if ($CreateRepo -and $hasGitHubCLI) {
    Write-Host "Creating GitHub repository..." -ForegroundColor Cyan
    
    $visibility = if ($Private) { "--private" } else { "--public" }
    
    try {
        gh repo create "$GitHubUsername/$RepositoryName" $visibility --description "$Description" --source . --push
        Write-Host "GitHub repository created and pushed" -ForegroundColor Green
    }
    catch {
        Write-Host "Failed to create GitHub repository" -ForegroundColor Red
        Write-Host "You can create it manually at: https://github.com/new" -ForegroundColor Yellow
    }
} elseif ($CreateRepo) {
    Write-Host "Manual repository creation required:" -ForegroundColor Yellow
    Write-Host "1. Go to https://github.com/new" -ForegroundColor Yellow
    Write-Host "2. Repository name: $RepositoryName" -ForegroundColor Yellow
    Write-Host "3. Description: $Description" -ForegroundColor Yellow
    Write-Host "4. Choose public/private as desired" -ForegroundColor Yellow
    Write-Host "5. Do NOT initialize with README, .gitignore, or license" -ForegroundColor Yellow
    Write-Host "6. Click 'Create repository'" -ForegroundColor Yellow
}

# Set up remote if not exists
$remoteExists = $false
try {
    git remote get-url origin | Out-Null
    $remoteExists = $true
    $remoteUrl = git remote get-url origin
    Write-Host "Remote origin already configured: $remoteUrl" -ForegroundColor Green
}
catch {
    $remoteUrl = "https://github.com/$GitHubUsername/$RepositoryName.git"
    Write-Host "Adding remote origin..." -ForegroundColor Cyan
    git remote add origin $remoteUrl
    Write-Host "Remote origin added: $remoteUrl" -ForegroundColor Green
}

# Create and switch to main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "Switching to main branch..." -ForegroundColor Cyan
    git branch -M main
    Write-Host "Switched to main branch" -ForegroundColor Green
}

# Push to GitHub if not created via CLI
if (-not ($CreateRepo -and $hasGitHubCLI)) {
    Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
    try {
        git push -u origin main
        Write-Host "Successfully pushed to GitHub" -ForegroundColor Green
    }
    catch {
        Write-Host "Push failed. Repository may not exist yet." -ForegroundColor Yellow
        Write-Host "Create the repository on GitHub first, then run:" -ForegroundColor Yellow
        Write-Host "git push -u origin main" -ForegroundColor Yellow
    }
}

# Create development branch
Write-Host "Creating development branch..." -ForegroundColor Cyan
try {
    git checkout -b develop
    git push -u origin develop
    git checkout main
    Write-Host "Development branch created" -ForegroundColor Green
}
catch {
    Write-Host "Could not create development branch (may already exist)" -ForegroundColor Yellow
}

# Display completion message
Write-Host ""
Write-Host "GitHub repository setup complete!" -ForegroundColor Green
Write-Host "Repository URL: https://github.com/$GitHubUsername/$RepositoryName" -ForegroundColor Cyan

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Configure repository settings:" -ForegroundColor Yellow
Write-Host "   - Enable Issues and Discussions" -ForegroundColor Gray
Write-Host "   - Set up branch protection rules" -ForegroundColor Gray
Write-Host "   - Configure GitHub Pages (if desired)" -ForegroundColor Gray

Write-Host "2. Set up GitHub Actions secrets (if needed):" -ForegroundColor Yellow
Write-Host "   - CODECOV_TOKEN (for code coverage)" -ForegroundColor Gray

Write-Host "3. Start development:" -ForegroundColor Yellow
Write-Host "   - Create issues for planned features" -ForegroundColor Gray
Write-Host "   - Set up project boards for tracking" -ForegroundColor Gray
Write-Host "   - Begin working on the develop branch" -ForegroundColor Gray

Write-Host ""
Write-Host "Useful Links:" -ForegroundColor Cyan
Write-Host "Repository: https://github.com/$GitHubUsername/$RepositoryName" -ForegroundColor Yellow
Write-Host "Issues: https://github.com/$GitHubUsername/$RepositoryName/issues" -ForegroundColor Yellow
Write-Host "Actions: https://github.com/$GitHubUsername/$RepositoryName/actions" -ForegroundColor Yellow

Write-Host ""
Write-Host "Happy coding!" -ForegroundColor Green