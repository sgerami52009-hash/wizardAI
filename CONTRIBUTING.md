# Contributing to Jetson Home Assistant

Thank you for your interest in contributing to the Jetson Home Assistant project! This document provides guidelines and information for contributors.

## 🌟 Code of Conduct

This project adheres to a code of conduct that promotes a welcoming and inclusive environment. By participating, you agree to uphold these standards:

- **Be respectful** and considerate in all interactions
- **Focus on child safety** as the top priority
- **Maintain privacy** and security standards
- **Support family-friendly** development practices
- **Welcome newcomers** and help them learn

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** and npm
- **TypeScript 5.x** knowledge
- **NVIDIA Jetson Nano Orin** for testing (recommended)
- **Git** for version control

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/yourusername/jetson-home-assistant.git
cd jetson-home-assistant

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

## 📋 How to Contribute

### 1. Choose Your Contribution Type

#### 🐛 Bug Reports
- Use the bug report template
- Include system information (Jetson model, JetPack version)
- Provide reproduction steps
- Include relevant logs (with PII removed)

#### ✨ Feature Requests
- Use the feature request template
- Explain the use case and benefits
- Consider child safety implications
- Provide mockups or examples if applicable

#### 🔧 Code Contributions
- Fork the repository
- Create a feature branch
- Follow coding standards
- Add tests for new functionality
- Ensure all tests pass
- Submit a pull request

### 2. Development Workflow

#### Branch Naming
```bash
# Feature branches
feature/voice-recognition-improvements
feature/avatar-customization-ui

# Bug fix branches
fix/memory-leak-in-audio-processor
fix/safety-filter-bypass

# Documentation branches
docs/api-reference-update
docs/deployment-guide-improvements
```

#### Commit Messages
Follow conventional commits format:
```bash
# Features
feat(voice): add multi-language wake word support
feat(avatar): implement emotional expression sync

# Bug fixes
fix(safety): prevent content filter bypass
fix(audio): resolve memory leak in stream processor

# Documentation
docs(readme): update installation instructions
docs(api): add endpoint documentation

# Tests
test(voice): add integration tests for speech recognition
test(safety): add child safety compliance tests
```

### 3. Code Standards

#### TypeScript Guidelines
```typescript
// Use explicit types
interface VoiceConfig {
  sampleRate: number;
  channels: number;
  bufferSize: number;
}

// Use async/await over promises
async function processVoiceInput(audio: AudioBuffer): Promise<string> {
  try {
    const result = await speechRecognizer.process(audio);
    return result.text;
  } catch (error) {
    logger.error('Voice processing failed', error);
    throw error;
  }
}

// Use proper error handling
class VoiceProcessingError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'VoiceProcessingError';
  }
}
```

#### Safety-First Development
```typescript
// Always validate child safety
async function generateResponse(input: string): Promise<string> {
  // REQUIRED: Validate content safety first
  const safetyResult = await validateChildSafeContent(input);
  if (!safetyResult.safe) {
    throw new SafetyViolationError(safetyResult.reason);
  }
  
  const response = await generateAIResponse(input);
  
  // REQUIRED: Validate output safety
  const outputSafety = await validateChildSafeContent(response);
  if (!outputSafety.safe) {
    return getFallbackResponse();
  }
  
  return response;
}
```

#### Performance Requirements
```typescript
// Monitor resource usage
class ResourceMonitor {
  private memoryLimit = 6 * 1024 * 1024 * 1024; // 6GB for Jetson
  
  checkMemoryUsage(): void {
    const usage = process.memoryUsage();
    if (usage.rss > this.memoryLimit) {
      logger.warn('Memory usage exceeds limit', { usage });
      this.triggerGarbageCollection();
    }
  }
}

// Optimize for Jetson hardware
const JETSON_OPTIMIZATIONS = {
  maxConcurrentTasks: 4,
  audioBufferSize: 1024,
  renderingFPS: 30,
  responseTimeoutMs: 500
};
```

### 4. Testing Requirements

#### Unit Tests
```typescript
// Test file: voice/speech-recognizer.test.ts
describe('SpeechRecognizer', () => {
  it('should process audio within latency requirements', async () => {
    const recognizer = new SpeechRecognizer();
    const audioBuffer = createTestAudioBuffer();
    
    const startTime = Date.now();
    const result = await recognizer.process(audioBuffer);
    const latency = Date.now() - startTime;
    
    expect(latency).toBeLessThan(300); // 300ms requirement
    expect(result.confidence).toBeGreaterThan(0.8);
  });
});
```

#### Safety Tests
```typescript
// Test file: safety/content-filter.test.ts
describe('ContentFilter', () => {
  it('should block inappropriate content', async () => {
    const filter = new ContentFilter();
    const inappropriateContent = 'test inappropriate content';
    
    const result = await filter.validate(inappropriateContent);
    
    expect(result.safe).toBe(false);
    expect(result.reason).toContain('inappropriate');
  });
});
```

#### Integration Tests
```typescript
// Test file: integration/voice-to-avatar.test.ts
describe('Voice to Avatar Integration', () => {
  it('should sync lip movements with speech', async () => {
    const voiceInput = createTestVoiceInput();
    const avatar = new AvatarSystem();
    
    await voiceInput.speak('Hello, how are you today?');
    
    expect(avatar.getCurrentAnimation()).toBe('speaking');
    expect(avatar.getLipSyncData()).toBeDefined();
  });
});
```

### 5. Documentation Standards

#### Code Documentation
```typescript
/**
 * Processes voice input and generates appropriate response
 * 
 * @param audioBuffer - Raw audio data from microphone
 * @param userProfile - User profile for personalization
 * @returns Promise resolving to processed response
 * 
 * @throws {SafetyViolationError} When content violates child safety
 * @throws {VoiceProcessingError} When audio processing fails
 * 
 * @example
 * ```typescript
 * const response = await processVoiceInput(audioBuffer, userProfile);
 * console.log(response.text);
 * ```
 */
async function processVoiceInput(
  audioBuffer: AudioBuffer,
  userProfile: UserProfile
): Promise<VoiceResponse> {
  // Implementation
}
```

#### API Documentation
```typescript
/**
 * @api {post} /voice/process Process Voice Input
 * @apiName ProcessVoice
 * @apiGroup Voice
 * @apiVersion 1.0.0
 * 
 * @apiDescription Processes voice input and returns transcribed text
 * 
 * @apiParam {File} audio Audio file (WAV, MP3, FLAC)
 * @apiParam {String} [language=en-US] Language code
 * 
 * @apiSuccess {String} text Transcribed text
 * @apiSuccess {Number} confidence Confidence score (0-1)
 * @apiSuccess {Number} processingTime Processing time in ms
 * 
 * @apiError {String} error Error message
 * @apiError {String} code Error code
 */
```

## 🛡️ Safety Guidelines

### Child Safety Requirements
1. **Content Validation**: All user-facing content MUST pass safety validation
2. **Parental Controls**: New features MUST respect parental settings
3. **Age Appropriateness**: Use simple, encouraging language
4. **Privacy Protection**: Never log or store personal information
5. **Audit Trail**: Maintain safety audit logs for compliance

### Security Requirements
1. **Input Validation**: Sanitize all user inputs
2. **Authentication**: Implement proper access controls
3. **Encryption**: Use AES-256 for sensitive data
4. **Network Security**: Use HTTPS for all communications
5. **Dependency Security**: Regular security audits of dependencies

## 🧪 Testing Guidelines

### Test Categories
1. **Unit Tests**: Individual component functionality
2. **Integration Tests**: Component interaction testing
3. **Performance Tests**: Jetson hardware optimization
4. **Safety Tests**: Child safety compliance
5. **Security Tests**: Vulnerability assessment

### Test Requirements
- **Coverage**: Minimum 80% code coverage
- **Performance**: All tests must pass on Jetson hardware
- **Safety**: Safety tests required for user-facing features
- **Documentation**: Test cases must be documented

### Running Tests
```bash
# All tests
npm test

# Specific test suites
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:safety

# Coverage report
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## 📦 Release Process

### Version Numbering
We follow semantic versioning (SemVer):
- **Major** (1.0.0): Breaking changes
- **Minor** (1.1.0): New features, backward compatible
- **Patch** (1.1.1): Bug fixes, backward compatible

### Release Checklist
- [ ] All tests pass
- [ ] Documentation updated
- [ ] Safety audit completed
- [ ] Performance benchmarks met
- [ ] Security scan passed
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Git tag created

## 🤝 Community

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Pull Requests**: Code contributions and reviews

### Getting Help
- **Documentation**: Check the docs/ directory first
- **Search Issues**: Look for existing solutions
- **Ask Questions**: Use GitHub Discussions
- **Join Development**: Comment on issues you'd like to work on

## 📄 Legal

### License Agreement
By contributing, you agree that your contributions will be licensed under the MIT License.

### Child Safety Compliance
All contributions must comply with:
- **COPPA** (Children's Online Privacy Protection Act)
- **GDPR** (General Data Protection Regulation)
- **Local privacy laws** in your jurisdiction

### Intellectual Property
- Ensure you have rights to contribute your code
- Don't include copyrighted material without permission
- Respect third-party licenses and attributions

## 🙏 Recognition

Contributors are recognized in:
- **README.md** contributors section
- **CHANGELOG.md** for significant contributions
- **GitHub contributors** page
- **Release notes** for major features

Thank you for helping make the Jetson Home Assistant a safe, fun, and educational experience for families! 🎉