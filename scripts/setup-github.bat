@echo off
echo.
echo ===============================================
echo  GitHub Repository Setup for Jetson Home Assistant
echo ===============================================
echo.

REM Check if Git is installed
git --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Git is not installed. Please install Git first.
    echo Download from: https://git-scm.com/download/windows
    pause
    exit /b 1
)
echo ✅ Git is installed

REM Check for required files
if not exist "README.md" (
    echo ❌ README.md not found
    goto :missing_files
)
if not exist "package.json" (
    echo ❌ package.json not found
    goto :missing_files
)
if not exist "CONTRIBUTING.md" (
    echo ❌ CONTRIBUTING.md not found
    goto :missing_files
)
if not exist "LICENSE" (
    echo ❌ LICENSE not found
    goto :missing_files
)
echo ✅ All required files present

REM Initialize git if needed
if not exist ".git" (
    echo 📁 Initializing Git repository...
    git init
    echo ✅ Git repository initialized
) else (
    echo ✅ Git repository already exists
)

REM Add files to git
echo 📋 Adding files to Git...
git add .

REM Create initial commit if needed
git log --oneline -1 >nul 2>&1
if errorlevel 1 (
    echo 💾 Creating initial commit...
    git commit -m "feat: initial project setup with comprehensive Jetson Home Assistant"
    echo ✅ Initial commit created
) else (
    echo ✅ Repository already has commits
)

REM Get GitHub username
set /p GITHUB_USERNAME="Enter your GitHub username: "
if "%GITHUB_USERNAME%"=="" (
    echo ❌ GitHub username is required
    pause
    exit /b 1
)

set REPO_NAME=jetson-home-assistant
set REMOTE_URL=https://github.com/%GITHUB_USERNAME%/%REPO_NAME%.git

REM Set up remote if not exists
git remote get-url origin >nul 2>&1
if errorlevel 1 (
    echo 🔗 Adding remote origin...
    git remote add origin %REMOTE_URL%
    echo ✅ Remote origin added: %REMOTE_URL%
) else (
    echo ✅ Remote origin already configured
)

REM Switch to main branch
echo 🌿 Switching to main branch...
git branch -M main

REM Instructions for manual repository creation
echo.
echo 📝 Manual repository creation required:
echo 1. Go to https://github.com/new
echo 2. Repository name: %REPO_NAME%
echo 3. Description: Family-friendly AI assistant for NVIDIA Jetson Nano Orin
echo 4. Choose public (recommended for open source)
echo 5. Do NOT initialize with README, .gitignore, or license
echo 6. Click 'Create repository'
echo.
echo After creating the repository, press any key to push...
pause

REM Push to GitHub
echo 📤 Pushing to GitHub...
git push -u origin main
if errorlevel 1 (
    echo ❌ Push failed. Make sure the repository exists on GitHub.
    pause
    exit /b 1
)
echo ✅ Successfully pushed to GitHub

REM Create development branch
echo 🌿 Creating development branch...
git checkout -b develop
git push -u origin develop
git checkout main
echo ✅ Development branch created

echo.
echo 🎉 GitHub repository setup complete!
echo Repository URL: https://github.com/%GITHUB_USERNAME%/%REPO_NAME%
echo.
echo 📋 Next Steps:
echo 1. Configure repository settings (Issues, Discussions, etc.)
echo 2. Set up branch protection rules
echo 3. Start development on the develop branch
echo.
echo Happy coding! 🚀
pause
goto :end

:missing_files
echo.
echo Please ensure all required files exist before running this script.
pause
exit /b 1

:end