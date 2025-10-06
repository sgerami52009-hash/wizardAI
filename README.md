# Jetson Home Assistant

A family-friendly AI assistant designed for NVIDIA Jetson Nano Orin with voice interaction, customizable avatars, and comprehensive safety features.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Jetson%20Nano%20Orin-green.svg)
![Node.js](https://img.shields.io/badge/node.js-18.x-brightgreen.svg)
![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)

## 🌟 Features

### 🎤 Voice Interaction
- **Wake word detection** with offline processing
- **Speech-to-text** using Whisper (local/cloud)
- **Text-to-speech** with emotional expressions
- **Multi-language support** with family profiles
- **< 500ms response latency** optimized for Jetson

### 👤 Avatar System
- **Customizable 3D avatars** with real-time rendering
- **Lip-sync animation** with phoneme mapping
- **Emotional expressions** synchronized with voice
- **Child-safe character designs** with parental controls
- **60fps rendering** on Jetson hardware

### 🛡️ Safety & Privacy
- **Child safety compliance** (COPPA, GDPR)
- **Content filtering** with allowlist approach
- **Parental controls** with activity monitoring
- **Data encryption** (AES-256) for all user data
- **Privacy-first design** with local processing

### 📅 Smart Scheduling
- **Family calendar integration** (Google, Outlook)
- **Intelligent reminders** with behavior learning
- **Voice-activated scheduling** with natural language
- **Multi-user profiles** with individual preferences
- **Conflict resolution** for family events

### 🏠 Smart Home Integration
- **Matter/Thread protocol** support
- **Device discovery** with safety controls
- **Voice commands** for home automation
- **Parental device restrictions** by schedule
- **Emergency override** capabilities

## 🚀 Quick Start

### Prerequisites
- **NVIDIA Jetson Nano Orin** (8GB RAM)
- **JetPack SDK 5.1+** (Ubuntu 20.04 L4T)
- **Audio devices** (USB microphone, speakers)
- **Network connection** (Ethernet/WiFi)

### Option 1: Network Deployment
```bash
# Set your Jetson details
export JETSON_HOST="jetson-nano.local"
export JETSON_USER="jetson"

# Deploy directly
cd deployment
./deploy-jetson.sh
```

### Option 2: USB Installation
```bash
# Create USB installer (Windows)
.\deployment\create-usb-installer.ps1 -UsbDrive E:

# Or Linux
./deployment/usb-installer-linux.sh --usb-device /dev/sdb1

# On Jetson: Run installer
sudo ./scripts/install.sh
```

### Access Your Assistant
- **Web Interface**: `http://jetson-nano.local:8080`
- **API Endpoint**: `http://jetson-nano.local:3000`
- **Health Check**: `http://jetson-nano.local:3000/health`

## 📖 Documentation

- [**Quick Deployment Guide**](DEPLOY-JETSON.md) - Get started in 5 minutes
- [**USB Installation**](deployment/README.md) - Offline installation guide
- [**API Documentation**](docs/API.md) - REST API reference
- [**Safety Guidelines**](safety/README.md) - Child safety implementation
- [**Development Guide**](docs/DEVELOPMENT.md) - Contributing guidelines

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Voice Input   │    │  Avatar System  │    │ Safety Systems  │
│                 │    │                 │    │                 │
│ • Wake Word     │    │ • 3D Rendering  │    │ • Content Filter│
│ • Speech-to-Text│    │ • Animations    │    │ • Parental Ctrl │
│ • Intent Class. │    │ • Lip Sync      │    │ • Privacy Mgmt  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │  Core Engine    │
                    │                 │
                    │ • Event Bus     │
                    │ • State Mgmt    │
                    │ • Resource Mon  │
                    └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Scheduling    │    │ Recommendations │    │  Smart Home     │
│                 │    │                 │    │                 │
│ • Calendar Sync │    │ • Learning Eng. │    │ • Device Ctrl   │
│ • Reminders     │    │ • Preferences   │    │ • Automation    │
│ • Family Coord  │    │ • Analytics     │    │ • Security      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Development

### Setup Development Environment
```bash
# Clone repository
git clone https://github.com/yourusername/jetson-home-assistant.git
cd jetson-home-assistant

# Install dependencies
npm install

# Build project
npm run build

# Run tests
npm test

# Start development server
npm run dev
```

### Project Structure
```
├── audio/              # Audio processing utilities
├── avatar/             # Avatar system and rendering
├── calendar/           # Calendar management
├── config/             # Configuration files
├── deployment/         # Deployment scripts and Docker
├── dist/               # Built application
├── models/             # AI models and data structures
├── recommendations/    # Recommendation engine
├── reminders/          # Reminder system
├── safety/             # Safety and parental controls
├── scheduling/         # Scheduling system
├── sync/               # External service synchronization
├── voice/              # Voice processing pipeline
└── scripts/            # Build and utility scripts
```

### Testing
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Performance tests
npm run test:performance

# Safety compliance tests
npm run test:safety

# System validation
npm run test:system
```

## 🔧 Configuration

### Production Configuration
Edit `config/production.json`:
```json
{
  "jetson": {
    "memory_limit_gb": 6,
    "cpu_cores": 6
  },
  "voice": {
    "wake_word": {
      "sensitivity": 0.7
    }
  },
  "safety": {
    "child_safety_enabled": true,
    "content_filter_level": "strict"
  }
}
```

### Environment Variables
```bash
# Required
NODE_ENV=production
CUDA_VISIBLE_DEVICES=0

# Optional
JETSON_HOST=jetson-nano.local
LOG_LEVEL=info
```

## 📊 Performance

### Jetson Nano Orin Optimizations
- **Memory Usage**: < 6GB (leaves 2GB for system)
- **Voice Latency**: < 500ms end-to-end
- **Avatar Rendering**: 60fps at 1024x600
- **CPU Usage**: < 80% under normal load
- **Temperature**: Monitored with thermal throttling

### Benchmarks
| Component | Latency | Memory | CPU |
|-----------|---------|--------|-----|
| Wake Word | < 100ms | 50MB   | 5%  |
| Speech Recognition | < 300ms | 200MB | 15% |
| Intent Processing | < 50ms | 100MB | 10% |
| Avatar Rendering | 16ms | 500MB | 25% |
| TTS Generation | < 200ms | 150MB | 20% |

## 🛡️ Security

### Child Safety Features
- **Content validation** on all user-facing content
- **Allowlist-only approach** for new integrations
- **Parental approval** required for device access
- **Activity logging** with privacy protection
- **Age-appropriate responses** with simple language

### Privacy Protection
- **Local processing** preferred over cloud
- **Data encryption** at rest and in transit
- **Automatic data purging** after 30 days
- **PII scrubbing** in all logs
- **GDPR/COPPA compliance** built-in

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md).

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Standards
- **TypeScript** for all new code
- **ESLint** configuration enforced
- **Jest** for testing
- **Child safety** validation required
- **Performance** benchmarks must pass

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- **Documentation**: Check the [docs](docs/) directory
- **Issues**: Report bugs on [GitHub Issues](https://github.com/yourusername/jetson-home-assistant/issues)
- **Discussions**: Join [GitHub Discussions](https://github.com/yourusername/jetson-home-assistant/discussions)

### Troubleshooting
- **Installation Issues**: See [DEPLOY-JETSON.md](DEPLOY-JETSON.md)
- **Performance Problems**: Check [Performance Guide](docs/PERFORMANCE.md)
- **Safety Concerns**: Review [Safety Guidelines](safety/README.md)

## 🙏 Acknowledgments

- **NVIDIA** for Jetson platform and development tools
- **OpenAI** for Whisper speech recognition
- **Picovoice** for wake word detection
- **Docker** for containerization support
- **Node.js** and **TypeScript** communities

## 🗺️ Roadmap

### Version 1.1 (Q2 2024)
- [ ] Multi-language avatar support
- [ ] Advanced emotion recognition
- [ ] Smart home device learning
- [ ] Enhanced parental controls

### Version 1.2 (Q3 2024)
- [ ] Offline-first operation
- [ ] Custom wake word training
- [ ] Advanced scheduling AI
- [ ] Mobile companion app

### Version 2.0 (Q4 2024)
- [ ] Multi-device synchronization
- [ ] Advanced AI tutoring
- [ ] Augmented reality features
- [ ] Professional deployment tools

---

**Made with ❤️ for families using NVIDIA Jetson Nano Orin**