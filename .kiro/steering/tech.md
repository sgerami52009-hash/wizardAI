# Technology Stack

## Current Setup
- **Version Control**: Git
- **IDE Configuration**: VSCode with custom settings
- **AI Assistant**: Kiro (MCP configuration disabled)

## Build System
Linux-based embedded OS or Android AOSP
OTA (Over-The-Air) update capability
Rollback mechanism for failed updates
Security patches every 90 days

## Frameworks & Libraries
Audio Pipeline
Audio Capture
: ALSA / PulseAudio
Wake Word Detection
: Porcupine (Picovoice) or Snowboy
Speech-to-Text
:
Cloud: Google Speech-to-Text, Whisper API
Local (future): Vosk, Coqui STT
Text-to-Speech
:
Cloud: Google Cloud TTS, Amazon Polly, ElevenLabs
┌─────────────────────────────────────────────┐
│ JetPack SDK 4.6.x (Ubuntu 18.04 L4T) │
│ - CUDA 10.2 │
│ - cuDNN 8.2 │
│ - TensorRT 8.0 │
│ - VPI (Vision Programming Interface) │
└─────────────────────────────────────────────┘
Local (future): Coqui TTS, Piper TTS
Audio Processing
: pyaudio, sounddevice
2. AI/LLM Integration
Primary
: OpenAI GPT-4 API (cloud-based)
Alternative
: Anthropic Claude API, Google Gemini
Local LLM (future)
: Llama 3 optimized for Jetson (requires quantization)
NLU
: Intent classification and entity extraction
3. Avatar/Character System
Rendering Engine
:
Option A
: Pygame (2D sprites, fastest to develop)
Option B
: Unity3D (2D/3D, more polished but heavier)
Option C
: Kivy (Python-native, good for prototyping)
Recommended for Beta
: Pygame for speed
Animation
: Sprite sheets with frame-based animation
Lip Sync
: Phoneme-based simple sync (viseme mapping)
4. UI Framework
Touch Interface
: PyQt5 or Kivy
Display Management
: X11 or Wayland
Resolution
: Scale UI for 1024x600 or 1280x800
5. Backend Services
Profile Manager
: SQLite database for user profiles
Alarm Service
: Python APScheduler
Weather API
: OpenWeatherMap or WeatherAPI.com
Calendar Sync
: Google Calendar API (OAuth2)

## Development Environment
- **Platform**: Windows (win32)
- **Shell**: PowerShell/CMD
- **Editor**: VSCode with Kiro integration

## Common Commands
Once the tech stack is defined, this section will include:
- Build commands
- Test execution
- Development server startup
- Deployment procedures

## Code Quality Tools
- To be configured based on chosen technology stack
- Consider adding linting, formatting, and testing tools

## Dependencies Management
- Package manager to be selected based on technology choice