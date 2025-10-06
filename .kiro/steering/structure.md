# Project Structure

## Current Organization
```
.
├── .git/           # Git version control
├── .kiro/          # Kiro AI assistant configuration
│   └── steering/   # AI guidance documents
├── .vscode/        # VSCode editor settings
│   └── settings.json
```

## Recommended Structure
Once development begins, consider organizing the project as follows:

### Source Code
- `src/` - Main source code directory
- `lib/` or `modules/` - Reusable components/libraries
- `tests/` - Test files and test utilities

### Configuration
- Root level configuration files (package.json, requirements.txt, etc.)
- `config/` - Environment-specific configurations
- `.env` files for environment variables

### Documentation
- `README.md` - Project overview and setup instructions
- `docs/` - Detailed documentation
- `CHANGELOG.md` - Version history

### Build & Deployment
- `build/` or `dist/` - Compiled/built artifacts
- `scripts/` - Build and deployment scripts
- `docker/` or `Dockerfile` - Containerization files

## Naming Conventions
- Use consistent naming patterns across the project
- Follow language-specific conventions for file and directory names
- Keep names descriptive but concise

## File Organization Principles
- Group related functionality together
- Separate concerns (business logic, UI, data access)
- Keep configuration files at appropriate levels
- Maintain clear separation between source and generated files