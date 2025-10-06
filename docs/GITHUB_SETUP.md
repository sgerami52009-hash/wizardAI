# GitHub Repository Setup Guide

This guide walks you through setting up the Jetson Home Assistant project on GitHub with all necessary configurations for a professional open-source project.

## 🚀 Quick Setup

### Option 1: Automated Setup (Recommended)
```powershell
# Run the setup script
.\scripts\setup-github.ps1 -GitHubUsername "yourusername" -CreateRepo -Description "Family-friendly AI assistant for NVIDIA Jetson Nano Orin"
```

### Option 2: Manual Setup
Follow the step-by-step instructions below.

## 📋 Prerequisites

### Required Tools
- **Git**: [Download Git](https://git-scm.com/download)
- **GitHub Account**: [Create account](https://github.com/join)
- **GitHub CLI** (optional): [Install GitHub CLI](https://cli.github.com/)

### Verify Installation
```bash
git --version
gh --version  # Optional
```

## 🏗️ Step-by-Step Setup

### 1. Create GitHub Repository

#### Option A: Using GitHub CLI
```bash
gh repo create jetson-home-assistant --public --description "Family-friendly AI assistant for NVIDIA Jetson Nano Orin"
```

#### Option B: Manual Creation
1. Go to [GitHub New Repository](https://github.com/new)
2. Repository name: `jetson-home-assistant`
3. Description: `Family-friendly AI assistant for NVIDIA Jetson Nano Orin with voice interaction and customizable avatars`
4. Choose **Public** (recommended for open source)
5. **Do NOT** initialize with README, .gitignore, or license
6. Click **Create repository**

### 2. Initialize Local Repository
```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
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

# Set main branch
git branch -M main

# Add remote origin
git remote add origin https://github.com/yourusername/jetson-home-assistant.git

# Push to GitHub
git push -u origin main
```

### 3. Create Development Branch
```bash
# Create and push develop branch
git checkout -b develop
git push -u origin develop
git checkout main
```

## ⚙️ Repository Configuration

### 1. Repository Settings

Navigate to **Settings** in your GitHub repository:

#### General Settings
- **Features**:
  - ✅ Issues
  - ✅ Discussions
  - ✅ Projects
  - ✅ Wiki (optional)
  - ✅ Sponsorships (optional)

- **Pull Requests**:
  - ✅ Allow merge commits
  - ✅ Allow squash merging
  - ✅ Allow rebase merging
  - ✅ Always suggest updating pull request branches
  - ✅ Allow auto-merge
  - ✅ Automatically delete head branches

#### Topics/Tags
Add relevant topics to help discovery:
```
jetson-nano, ai-assistant, voice-recognition, child-safety, 
family-friendly, typescript, docker, nvidia, home-automation,
avatar-system, speech-to-text, text-to-speech
```

### 2. Branch Protection Rules

Go to **Settings > Branches** and add protection for `main`:

```yaml
Branch name pattern: main
Protect matching branches:
  ✅ Require a pull request before merging
    ✅ Require approvals: 1
    ✅ Dismiss stale PR approvals when new commits are pushed
    ✅ Require review from code owners
  ✅ Require status checks to pass before merging
    ✅ Require branches to be up to date before merging
    Required status checks:
      - test
      - safety-tests  
      - security
      - performance
  ✅ Require conversation resolution before merging
  ✅ Require signed commits (recommended)
  ✅ Include administrators
```

### 3. Security Settings

Go to **Settings > Security & analysis**:

- **Dependency graph**: ✅ Enabled
- **Dependabot alerts**: ✅ Enabled
- **Dependabot security updates**: ✅ Enabled
- **Dependabot version updates**: ✅ Enabled
- **Code scanning alerts**: ✅ Enabled
- **Secret scanning alerts**: ✅ Enabled

### 4. Actions Settings

Go to **Settings > Actions > General**:

- **Actions permissions**: Allow all actions and reusable workflows
- **Artifact and log retention**: 90 days
- **Fork pull request workflows**: Require approval for first-time contributors

## 🔐 Secrets Configuration

### Repository Secrets
Go to **Settings > Secrets and variables > Actions**:

#### Required Secrets
```bash
# Code coverage (optional)
CODECOV_TOKEN=your_codecov_token

# Container registry (if using private registry)
REGISTRY_USERNAME=your_username
REGISTRY_PASSWORD=your_password
```

#### Environment Variables
```bash
NODE_ENV=production
JETSON_PLATFORM=nano-orin
```

## 📊 GitHub Features Setup

### 1. Issues Configuration

#### Labels
The repository includes predefined labels in `.github/ISSUE_TEMPLATE/`. Additional custom labels:

```yaml
# Priority Labels
priority/low - Low priority
priority/medium - Medium priority  
priority/high - High priority
priority/critical - Critical priority

# Component Labels
component/voice - Voice processing
component/avatar - Avatar system
component/safety - Safety systems
component/deployment - Deployment
component/docs - Documentation

# Status Labels
status/needs-triage - Needs triage
status/in-progress - In progress
status/blocked - Blocked
status/ready-for-review - Ready for review
```

#### Issue Templates
The repository includes:
- 🐛 Bug Report (`bug_report.yml`)
- ✨ Feature Request (`feature_request.yml`)
- 📚 Documentation (`documentation.yml`)
- 🔒 Security Issue (`security.yml`)

### 2. Discussions Setup

Enable **Discussions** and create categories:
- **General** - General discussions
- **Ideas** - Feature ideas and brainstorming
- **Q&A** - Questions and answers
- **Show and tell** - Community showcases
- **Deployment Help** - Jetson deployment assistance

### 3. Projects Setup

Create a project board for tracking:
1. Go to **Projects** tab
2. Create **New project**
3. Choose **Board** template
4. Add columns:
   - 📋 Backlog
   - 🔄 In Progress
   - 👀 In Review
   - ✅ Done
   - 🚀 Released

### 4. Wiki Setup (Optional)

If enabled, create wiki pages:
- **Home** - Project overview
- **Installation** - Detailed installation guide
- **API Reference** - Complete API documentation
- **Troubleshooting** - Common issues and solutions
- **Hardware Compatibility** - Jetson device compatibility

## 🤖 GitHub Actions Workflows

The repository includes comprehensive CI/CD workflows:

### Workflow Files
- `.github/workflows/ci.yml` - Main CI/CD pipeline
- `.github/workflows/security.yml` - Security scanning
- `.github/workflows/performance.yml` - Performance testing
- `.github/workflows/docs.yml` - Documentation deployment

### Workflow Features
- ✅ Multi-Node.js version testing
- ✅ Child safety compliance testing
- ✅ Security vulnerability scanning
- ✅ Performance benchmarking
- ✅ Docker image building for ARM64
- ✅ Automated documentation deployment
- ✅ Release automation

## 📈 Monitoring and Analytics

### 1. Insights Configuration
Monitor repository health via **Insights** tab:
- **Pulse** - Recent activity
- **Contributors** - Contributor statistics
- **Community** - Community health score
- **Traffic** - Repository traffic
- **Commits** - Commit activity
- **Code frequency** - Code changes over time
- **Dependency graph** - Dependencies visualization

### 2. Code Coverage
Set up code coverage reporting:
1. Sign up for [Codecov](https://codecov.io/)
2. Add repository to Codecov
3. Add `CODECOV_TOKEN` to repository secrets
4. Coverage reports will be automatically generated

### 3. Performance Monitoring
The CI pipeline includes performance benchmarks:
- Memory usage tracking
- Response time measurements
- Resource utilization monitoring
- Jetson-specific optimizations validation

## 🚀 Release Management

### 1. Release Strategy
- **main** branch: Stable releases
- **develop** branch: Development work
- **feature/** branches: New features
- **hotfix/** branches: Critical fixes

### 2. Semantic Versioning
Follow [SemVer](https://semver.org/):
- **Major** (1.0.0): Breaking changes
- **Minor** (1.1.0): New features, backward compatible
- **Patch** (1.1.1): Bug fixes, backward compatible

### 3. Release Process
1. Create release branch from develop
2. Update version numbers
3. Update CHANGELOG.md
4. Create pull request to main
5. After merge, create GitHub release
6. Automated workflows handle deployment

## 🤝 Community Guidelines

### 1. Code of Conduct
Create `CODE_OF_CONDUCT.md`:
```markdown
# Contributor Covenant Code of Conduct

This project follows the Contributor Covenant Code of Conduct.
All contributors are expected to uphold this code.

## Child Safety Priority
This project prioritizes child safety above all else.
All contributions must maintain family-friendly standards.
```

### 2. Contributing Guidelines
The repository includes comprehensive `CONTRIBUTING.md` with:
- Development setup instructions
- Code standards and review process
- Child safety requirements
- Testing requirements
- Documentation standards

### 3. Support Channels
- **Issues**: Bug reports and feature requests
- **Discussions**: General questions and community
- **Wiki**: Documentation and guides
- **Email**: security@yourproject.com (for security issues)

## 📚 Documentation Strategy

### 1. Documentation Structure
```
docs/
├── API.md              # API reference
├── DEVELOPMENT.md      # Development guide
├── DEPLOYMENT.md       # Deployment guide
├── PERFORMANCE.md      # Performance optimization
├── SECURITY.md         # Security guidelines
├── TROUBLESHOOTING.md  # Common issues
└── HARDWARE.md         # Hardware compatibility
```

### 2. Auto-Generated Documentation
- **API docs**: Generated from TypeScript interfaces
- **Code docs**: Generated from JSDoc comments
- **Coverage reports**: Generated by Jest
- **Performance reports**: Generated by benchmarks

## 🔍 Quality Assurance

### 1. Automated Checks
- **Linting**: ESLint with TypeScript rules
- **Type checking**: TypeScript compiler
- **Testing**: Jest with comprehensive test suites
- **Security**: CodeQL and dependency scanning
- **Performance**: Automated benchmarking

### 2. Manual Review Process
- **Code review**: Required for all PRs
- **Child safety review**: Required for user-facing features
- **Performance review**: Required for Jetson optimizations
- **Documentation review**: Required for public APIs

## 🎯 Success Metrics

Track project success through:
- **Stars and forks**: Community interest
- **Issues and PRs**: Community engagement
- **Downloads**: Usage metrics
- **Performance benchmarks**: Technical quality
- **Safety compliance**: Child safety adherence

## 🆘 Troubleshooting

### Common Issues

**Push rejected due to branch protection**
```bash
# Create PR instead of direct push to main
git checkout -b feature/your-feature
git push -u origin feature/your-feature
# Then create PR on GitHub
```

**Actions failing due to secrets**
```bash
# Check repository secrets are configured
# Go to Settings > Secrets and variables > Actions
```

**Large files rejected**
```bash
# Use Git LFS for large files
git lfs track "*.bin"
git lfs track "*.onnx"
git add .gitattributes
```

### Getting Help
- Check existing issues and discussions
- Review documentation in docs/ directory
- Create new issue with detailed information
- Join community discussions

---

**Ready to start contributing?** Check out [CONTRIBUTING.md](../CONTRIBUTING.md) for development guidelines!