---
inclusion: always
---

# Home Assistant Development Guide

Family-friendly AI assistant for Jetson Nano Orin with voice interaction and customizable avatars.

## Non-Negotiable Safety Rules

### Child Safety (Ages 5-17)
- ALL user-facing content MUST pass `validateChildSafeContent()` validation
- Use allowlist-only approach: block by default, approve explicitly
- New integrations require `parentalApproval: true` flag
- User messages MUST use simple, encouraging language without technical jargon

### Hardware Constraints (Jetson Nano Orin)
- Voice response latency MUST be ≤ 500ms
- Memory usage MUST stay under 8GB RAM
- Core features MUST work offline
- Gracefully disable features before system failure

### Privacy & Security
- NEVER persist voice data to disk - memory processing only
- Use AES-256 encryption for all user data
- Auto-purge logs after 30 days
- Prefer on-device processing over cloud APIs

## Required Architecture

### Module Structure
```
voice/     # Speech recognition, TTS, wake word detection
display/   # Avatar rendering, UI components, animations  
ai/        # Conversation engine, content safety filters
device/    # Hardware abstraction, GPIO, sensors
profiles/  # User management, parental controls, preferences
```

### Mandatory Code Patterns
- Function names: verb-noun pattern (`processVoiceCommand`, `renderAvatarFrame`)
- Wrap ALL external calls with try-catch and timeouts
- NEVER mutate user profile objects - use immutable patterns
- Strip PII with `sanitizeForLog()` before any logging
- Provide offline fallbacks for ALL network features

### Event Flow Requirements
- Voice pipeline: `voiceInput → processing → safetyCheck → response → audioOutput`
- Avatar state: Use EventEmitter pattern (`avatar.emit('expressionChange')`)
- User actions: MUST be reversible with undo capability
- Debug: Store event sequences for voice interaction troubleshooting

## Implementation Requirements

### Voice Processing
- Wake word detection MUST be offline only
- Show visual feedback during ALL voice operations
- Hard timeout: 5 seconds max for voice processing
- Support per-user voice models and language preferences
- Error responses: "I didn't catch that" (never technical errors)

### Avatar System
- Separate modules: appearance, personality, voice
- ALL new actions MUST pass `validateAvatarBehavior()`
- Target: 60fps rendering on Jetson Nano Orin
- Encrypt avatar customizations with user-specific keys
- ALL avatar actions require child-safety review

### Smart Home Integration
- Prefer Matter/Thread over proprietary protocols
- Explicit opt-in required for device discovery/control
- ALWAYS provide physical/manual control alternatives
- Implement parental controls for device access schedules
- Block dangerous devices (ovens, locks, security systems)

### Error Handling
- User messages: encouraging, child-friendly ("Let's try that again!")
- Separate technical logs from user-facing messages
- Network retries: exponential backoff with jitter
- Disable broken features rather than crash
- Always provide clear recovery steps

## Development Standards

### Required Quality Gates
- Run `npm run safety-audit` on ALL user-facing content
- Verify voice latency < 500ms with `npm run perf-test`
- Confirm < 8GB memory usage under load
- Validate core features work offline
- Unit tests required for ALL voice processing functions
- Integration tests for voice-to-avatar coordination
- Document safety considerations for ALL new features

### File Naming (Enforced)
- Components: PascalCase (`VoiceProcessor.js`, `AvatarRenderer.js`)
- Utilities: camelCase (`audioUtils.js`, `safetyValidator.js`)
- Tests: `.test.js` suffix (`VoiceProcessor.test.js`)
- Config: kebab-case (`voice-config.json`, `avatar-settings.json`)

### Documentation (Required)
- Function comments MUST include safety implications and performance notes
- API docs MUST include child-safety notes and usage examples
- Document failure modes and recovery strategies
- Include Jetson Nano Orin memory/latency considerations

## AI Assistant Guidelines

When implementing features:
1. ALWAYS validate child safety first
2. Check performance constraints early
3. Implement offline fallbacks by default
4. Use encouraging, simple language in user messages
5. Separate technical logging from user-facing content
6. Test on Jetson Nano Orin hardware constraints