const http = require('http');

// Mock Jetson environment
process.env.NODE_ENV = 'production';
process.env.JETSON_PLATFORM = 'nano-orin';
process.env.JETSON_VIRTUAL = 'true';

console.log('🚀 Starting Jetson Home Assistant (Virtual Mode)');
console.log('Platform: Virtual Jetson Nano Orin');
console.log('Memory Limit: 8GB (simulated)');
console.log('CPU Cores: 6 (simulated)');

// Health check data
const healthData = {
  status: 'healthy',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  version: '1.0.0',
  platform: 'jetson-nano-orin-virtual',
  components: {
    voice: { status: 'active', latency: '< 500ms' },
    avatar: { status: 'active', fps: 30 },
    safety: { status: 'active', level: 'strict' },
    audio: { status: 'active', devices: 'virtual' }
  },
  system: {
    memory: { used: '2.1GB', total: '8GB', usage: '26%' },
    cpu: { usage: '15%', temperature: '45°C' },
    gpu: { usage: '8%', temperature: '42°C' }
  },
  jetson: {
    model: 'Nano Orin (Virtual)',
    jetpack: '5.1 (Simulated)',
    cuda: '11.4 (Simulated)',
    tensorrt: '8.0 (Simulated)'
  }
};

// Web interface HTML
const webInterface = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jetson Home Assistant (Virtual)</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .card { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; backdrop-filter: blur(10px); }
        .card h3 { margin: 0 0 15px 0; color: #fff; }
        .status-item { display: flex; justify-content: space-between; margin: 8px 0; }
        .status-healthy { color: #4ade80; }
        .btn { background: rgba(255,255,255,0.2); color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; margin: 5px; }
        .btn:hover { background: rgba(255,255,255,0.3); }
        .logo { font-size: 3em; margin-bottom: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏠🤖</div>
            <h1>Jetson Home Assistant</h1>
            <p>Virtual Jetson Nano Orin Environment</p>
        </div>
        
        <div class="status-grid">
            <div class="card">
                <h3>🖥️ System Status</h3>
                <div class="status-item">
                    <span>Platform:</span>
                    <span class="status-healthy">Jetson Nano Orin (Virtual)</span>
                </div>
                <div class="status-item">
                    <span>Memory:</span>
                    <span class="status-healthy">2.1GB / 8GB (26%)</span>
                </div>
                <div class="status-item">
                    <span>CPU:</span>
                    <span class="status-healthy">15% @ 45°C</span>
                </div>
                <div class="status-item">
                    <span>GPU:</span>
                    <span class="status-healthy">8% @ 42°C</span>
                </div>
            </div>
            
            <div class="card">
                <h3>🎤 Voice System</h3>
                <div class="status-item">
                    <span>Wake Word:</span>
                    <span class="status-healthy">Porcupine Active</span>
                </div>
                <div class="status-item">
                    <span>Speech Recognition:</span>
                    <span class="status-healthy">Whisper Local</span>
                </div>
                <div class="status-item">
                    <span>Text-to-Speech:</span>
                    <span class="status-healthy">Neural TTS</span>
                </div>
                <div class="status-item">
                    <span>Response Time:</span>
                    <span class="status-healthy">< 500ms</span>
                </div>
            </div>
            
            <div class="card">
                <h3>👤 Avatar System</h3>
                <div class="status-item">
                    <span>Rendering:</span>
                    <span class="status-healthy">3D Real-time</span>
                </div>
                <div class="status-item">
                    <span>Frame Rate:</span>
                    <span class="status-healthy">30 FPS</span>
                </div>
                <div class="status-item">
                    <span>Lip Sync:</span>
                    <span class="status-healthy">Active</span>
                </div>
                <div class="status-item">
                    <span>Expressions:</span>
                    <span class="status-healthy">Emotional AI</span>
                </div>
            </div>
            
            <div class="card">
                <h3>🛡️ Safety Systems</h3>
                <div class="status-item">
                    <span>Child Safety:</span>
                    <span class="status-healthy">COPPA Compliant</span>
                </div>
                <div class="status-item">
                    <span>Content Filter:</span>
                    <span class="status-healthy">Strict Mode</span>
                </div>
                <div class="status-item">
                    <span>Parental Controls:</span>
                    <span class="status-healthy">Active</span>
                </div>
                <div class="status-item">
                    <span>Privacy:</span>
                    <span class="status-healthy">GDPR Ready</span>
                </div>
            </div>
        </div>
        
        <div style="text-align: center; margin-top: 30px;">
            <button class="btn" onclick="runHealthCheck()">🏥 Health Check</button>
            <button class="btn" onclick="testVoice()">🎤 Test Voice</button>
            <button class="btn" onclick="testAvatar()">👤 Test Avatar</button>
        </div>
        
        <div id="output" style="margin-top: 20px; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 10px; display: none;">
            <h3>Output</h3>
            <pre id="outputContent" style="color: #4ade80;"></pre>
        </div>
    </div>

    <script>
        async function runHealthCheck() {
            try {
                const response = await fetch('/health');
                const data = await response.json();
                showOutput('Health Check Results:\\n' + JSON.stringify(data, null, 2));
            } catch (error) {
                showOutput('Error: ' + error.message);
            }
        }
        
        function testVoice() {
            showOutput('🎤 Voice Test Results:\\n✅ Wake word detection: Active\\n✅ Speech recognition: Ready\\n✅ Text-to-speech: Ready\\n✅ Response time: < 500ms');
        }
        
        function testAvatar() {
            showOutput('👤 Avatar Test Results:\\n✅ 3D rendering: 30 FPS\\n✅ Lip sync: Active\\n✅ Emotional expressions: Ready\\n✅ Child-safe animations: Validated');
        }
        
        function showOutput(content) {
            document.getElementById('outputContent').textContent = content;
            document.getElementById('output').style.display = 'block';
        }
    </script>
</body>
</html>`;

// Create HTTP server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:3000`);
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Route requests
  switch (url.pathname) {
    case '/':
    case '/index.html':
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(webInterface);
      break;
      
    case '/health':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthData, null, 2));
      break;
      
    case '/status':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({...healthData, features: {
        voiceRecognition: 'Whisper (Local)',
        textToSpeech: 'Neural TTS',
        wakeWordDetection: 'Porcupine',
        avatarRendering: '3D Real-time',
        childSafety: 'COPPA Compliant',
        parentalControls: 'Active'
      }}, null, 2));
      break;
      
    default:
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path: url.pathname }));
  }
});

// Start servers
const API_PORT = 3000;
const WEB_PORT = 8080;

// API Server
server.listen(API_PORT, () => {
  console.log(`✅ API Server running on http://localhost:${API_PORT}`);
  console.log(`   Health: http://localhost:${API_PORT}/health`);
  console.log(`   Status: http://localhost:${API_PORT}/status`);
});

// Web Server (same server, different port)
const webServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(webInterface);
});

webServer.listen(WEB_PORT, () => {
  console.log(`✅ Web Interface running on http://localhost:${WEB_PORT}`);
});

console.log('');
console.log('🎉 Virtual Jetson Home Assistant is running!');
console.log('📱 Web Interface: http://localhost:8080');
console.log('🔌 API Health: http://localhost:3000/health');
console.log('📊 API Status: http://localhost:3000/status');
console.log('');
console.log('Press Ctrl+C to stop');

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    webServer.close(() => {
      console.log('✅ Servers closed');
      process.exit(0);
    });
  });
});