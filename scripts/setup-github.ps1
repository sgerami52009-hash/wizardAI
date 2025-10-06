# GitHub Repository Setup Script
# This script helps initialize the GitHub repository for Jetson Home Assistant

param(
    [Parameter(Mandatory=$true)]
    [string]$GitHubUsername,
    
    [Parameter(Mandatory=$true)]
    [string]$RepositoryName = "jetson-home-assistant",
    
    [switch]$CreateRepo = $false,
    [switch]$Private = $false,
    [string]$Description = "Family-friendly AI assistant for NVIDIA Jetson Nano Orin with voice interaction and customizable avatars"
)

# Colors for output
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Blue = "Cyan"

function Write-Status {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Test-GitInstalled {
    try {
        git --version | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Test-GitHubCLI {
    try {
        gh --version | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

Write-Status "🚀 Setting up GitHub repository for Jetson Home Assistant" $Blue
Write-Status "Repository: $GitHubUsername/$RepositoryName" $Yellow

# Check prerequisites
Write-Status "🔍 Checking prerequisites..." $Blue

if (-not (Test-GitInstalled)) {
    Write-Status "❌ Git is not installed. Please install Git first." $Red
    Write-Status "Download from: https://git-scm.com/download/windows" $Yellow
    exit 1
}
Write-Status "✅ Git is installed" $Green

$hasGitHubCLI = Test-GitHubCLI
if (-not $hasGitHubCLI -and $CreateRepo) {
    Write-Status "⚠️ GitHub CLI not found. Repository creation will be manual." $Yellow
    Write-Status "Install GitHub CLI from: https://cli.github.com/" $Yellow
}

# Initialize git repository if not already initialized
if (-not (Test-Path ".git")) {
    Write-Status "📁 Initializing Git repository..." $Blue
    git init
    Write-Status "✅ Git repository initialized" $Green
} else {
    Write-Status "✅ Git repository already exists" $Green
}

# Create .gitignore if it doesn't exist
if (-not (Test-Path ".gitignore")) {
    Write-Status "❌ .gitignore file not found" $Red
    Write-Status "Please ensure .gitignore file exists before continuing" $Yellow
    exit 1
}
Write-Status "✅ .gitignore file exists" $Green

# Check for required files
$requiredFiles = @(
    "README.md",
    "package.json",
    "CONTRIBUTING.md",
    "LICENSE",
    "CHANGELOG.md"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    if (-not (Test-Path $file)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Status "❌ Missing required files:" $Red
    foreach ($file in $missingFiles) {
        Write-Status "  - $file" $Red
    }
    exit 1
}
Write-Status "✅ All required files present" $Green

# Add files to git
Write-Status "📋 Adding files to Git..." $Blue
git add .
git status

# Create initial commit
$commitExists = git log --oneline 2>$null
if (-not $commitExists) {
    Write-Status "💾 Creating initial commit..." $Blue
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
- Add parental controls with activity logging

This initial release provides a complete family-friendly AI assistant
optimized for NVIDIA Jetson Nano Orin hardware with comprehensive
child safety features and privacy protection."
    
    Write-Status "✅ Initial commit created" $Green
} else {
    Write-Status "✅ Repository already has commits" $Green
}

# Create GitHub repository if requested
if ($CreateRepo -and $hasGitHubCLI) {
    Write-Status "🌐 Creating GitHub repository..." $Blue
    
    $visibility = if ($Private) { "--private" } else { "--public" }
    
    try {
        gh repo create "$GitHubUsername/$RepositoryName" $visibility --description "$Description" --source . --push
        Write-Status "✅ GitHub repository created and pushed" $Green
    } catch {
        Write-Status "❌ Failed to create GitHub repository: $_" $Red
        Write-Status "You can create it manually at: https://github.com/new" $Yellow
    }
} elseif ($CreateRepo) {
    Write-Status "📝 Manual repository creation required:" $Yellow
    Write-Status "1. Go to https://github.com/new" $Yellow
    Write-Status "2. Repository name: $RepositoryName" $Yellow
    Write-Status "3. Description: $Description" $Yellow
    Write-Status "4. Choose public/private as desired" $Yellow
    Write-Status "5. Do NOT initialize with README, .gitignore, or license" $Yellow
    Write-Status "6. Click 'Create repository'" $Yellow
    Write-Status "7. Run the commands shown on the next page" $Yellow
}

# Set up remote if not exists
$remoteExists = git remote get-url origin 2>$null
if (-not $remoteExists) {
    $remoteUrl = "https://github.com/$GitHubUsername/$RepositoryName.git"
    Write-Status "🔗 Adding remote origin..." $Blue
    git remote add origin $remoteUrl
    Write-Status "✅ Remote origin added: $remoteUrl" $Green
} else {
    Write-Status "✅ Remote origin already configured: $remoteExists" $Green
}

# Create and switch to main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Status "🌿 Switching to main branch..." $Blue
    git branch -M main
    Write-Status "✅ Switched to main branch" $Green
}

# Push to GitHub if repository exists
if (-not $CreateRepo -or $hasGitHubCLI) {
    Write-Status "📤 Pushing to GitHub..." $Blue
    try {
        git push -u origin main
        Write-Status "✅ Successfully pushed to GitHub" $Green
    } catch {
        Write-Status "⚠️ Push failed. Repository may not exist yet." $Yellow
        Write-Status "Create the repository on GitHub first, then run:" $Yellow
        Write-Status "git push -u origin main" $Yellow
    }
}

# Set up branch protection (requires GitHub CLI and appropriate permissions)
if ($hasGitHubCLI -and -not $Private) {
    Write-Status "🛡️ Setting up branch protection..." $Blue
    try {
        $statusChecks = '{"strict":true,"contexts":["test","safety-tests","security"]}'
        $reviewSettings = '{"required_approving_review_count":1,"dismiss_stale_reviews":true}'
        
        gh api "repos/$GitHubUsername/$RepositoryName/branches/main/protection" `
            --method PUT `
            --field "required_status_checks=$statusChecks" `
            --field "enforce_admins=true" `
            --field "required_pull_request_reviews=$reviewSettings" `
            --field "restrictions=null"
        Write-Status "✅ Branch protection configured" $Green
    }
    catch {
        Write-Status "⚠️ Could not set up branch protection automatically" $Yellow
        Write-Status "You can configure it manually in repository settings" $Yellow
    }
}

# Create development branch
Write-Status "🌿 Creating development branch..." $Blue
git checkout -b develop
git push -u origin develop
git checkout main
Write-Status "✅ Development branch created" $Green

# Display next steps
Write-Status "`n🎉 GitHub repository setup complete!" $Green
Write-Status "Repository URL: https://github.com/$GitHubUsername/$RepositoryName" $Blue

Write-Status "`n📋 Next Steps:" $Blue
Write-Status "1. Configure repository settings:" $Yellow
Write-Status "   - Enable Issues and Discussions" $Yellow
Write-Status "   - Set up branch protection rules" $Yellow
Write-Status "   - Configure GitHub Pages (if desired)" $Yellow
Write-Status "   - Add repository topics/tags" $Yellow

Write-Status "2. Set up GitHub Actions secrets (if needed):" $Yellow
Write-Status "   - CODECOV_TOKEN (for code coverage)" $Yellow
Write-Status "   - Any deployment secrets" $Yellow

Write-Status "3. Invite collaborators:" $Yellow
Write-Status "   - Go to Settings > Manage access" $Yellow
Write-Status "   - Add team members with appropriate permissions" $Yellow

Write-Status "4. Configure repository settings:" $Yellow
Write-Status "   - Enable vulnerability alerts" $Yellow
Write-Status "   - Set up automated security updates" $Yellow
Write-Status "   - Configure merge settings" $Yellow

Write-Status "5. Create your first issue or start development:" $Yellow
Write-Status "   - Create issues for planned features" $Yellow
Write-Status "   - Set up project boards for tracking" $Yellow
Write-Status "   - Start working on the develop branch" $Yellow

Write-Status "`n🔗 Useful Links:" $Blue
Write-Status "Repository: https://github.com/$GitHubUsername/$RepositoryName" $Yellow
Write-Status "Issues: https://github.com/$GitHubUsername/$RepositoryName/issues" $Yellow
Write-Status "Actions: https://github.com/$GitHubUsername/$RepositoryName/actions" $Yellow
Write-Status "Settings: https://github.com/$GitHubUsername/$RepositoryName/settings" $Yellow

Write-Status "`n📚 Documentation:" $Blue
Write-Status "- README.md: Project overview and quick start" $Yellow
Write-Status "- CONTRIBUTING.md: Contribution guidelines" $Yellow
Write-Status "- DEPLOY-JETSON.md: Deployment instructions" $Yellow
Write-Status "- docs/: Detailed documentation" $Yellow

Write-Status "`nHappy coding! 🚀" $Green