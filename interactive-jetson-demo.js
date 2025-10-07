const http = require('http');
const fs = require('fs');
const path = require('path');

// Mock Jetson environment
process.env.NODE_ENV = 'production';
process.env.JETSON_PLATFORM = 'nano-orin';
process.env.JETSON_VIRTUAL = 'true';

console.log('🚀 Starting Interactive Jetson Home Assistant (Virtual Mode)');
console.log('Platform: Virtual Jetson Nano Orin with Voice Interaction');
console.log('Memory Limit: 8GB (simulated)');
console.log('CPU Cores: 6 (simulated)');

// Health check data
const healthData = {
  status: 'healthy',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  version: '1.0.0',
  platform: 'jetson-nano-orin-virtual-interactive',
  components: {
    voice: { status: 'active', latency: '< 500ms', microphone: 'virtual', speaker: 'virtual' },
    avatar: { status: 'active', fps: 30, expressions: 'enabled', lipSync: 'active' },
    safety: { status: 'active', level: 'strict', childMode: 'enabled' },
    audio: { status: 'active', devices: 'virtual', tts: 'neural', stt: 'whisper' }
  },
  system: {
    memory: { used: '2.1GB', total: '8GB', usage: '26%' },
    cpu: { usage: '15%', temperature: '45°C' },
    gpu: { usage: '8%', temperature: '42°C' }
  },
  jetson: {
    model: 'Nano Orin (Virtual Interactive)',
    jetpack: '5.1 (Simulated)',
    cuda: '11.4 (Simulated)',
    tensorrt: '8.0 (Simulated)'
  }
};

// Conversation state
let conversationHistory = [];
let isListening = false;
let currentUser = 'Shervin';

// Simulated responses for different inputs
const responses = {
  'hello': [
    "Hello Shervin! I'm your virtual home assistant. How can I help you today?",
    "Hi there! Great to see you. What would you like to do?",
    "Hello! I'm ready to assist you with anything you need.",
    "Hey Shervin! Nice to hear from you. What's on your mind?",
    "Good to see you! I'm here and ready to help with whatever you need."
  ],
  'weather': [
    "The weather today is sunny with a temperature of 72°F. Perfect for outdoor activities!",
    "It's a beautiful day outside - 72°F and sunny. Great weather for the family!",
    "Today's forecast shows sunny skies and 72°F. Ideal conditions!",
    "Beautiful weather today! 72 degrees and sunny - perfect for spending time outdoors with the family.",
    "The weather is lovely today - sunny and 72°F. Great day for outdoor family activities!"
  ],
  'time': [
    "The current time is " + new Date().toLocaleTimeString() + ".",
    "It's " + new Date().toLocaleTimeString() + " right now.",
    "The time is " + new Date().toLocaleTimeString() + ".",
    "Right now it's " + new Date().toLocaleTimeString() + ".",
    "The current time is " + new Date().toLocaleTimeString() + ". Is there anything time-sensitive I can help you with?"
  ],
  'schedule': [
    "Your schedule for today includes a family meeting at 3 PM and dinner preparation at 6 PM.",
    "You have two items on your schedule: family time at 3 PM and cooking at 6 PM.",
    "Today's schedule: 3 PM family meeting, 6 PM dinner prep. Anything else you'd like to add?",
    "Looking at your schedule, you have family time at 3 PM and dinner prep at 6 PM. Would you like me to set any reminders?",
    "Your day includes a 3 PM family meeting and 6 PM dinner preparation. I can help you plan around these events."
  ],
  'kids': [
    "The kids' activities for today include educational games at 2 PM and story time at 7 PM.",
    "Children's schedule: learning games this afternoon and bedtime stories tonight.",
    "The little ones have fun educational activities planned - games and stories!",
    "Today's kids' activities: educational games at 2 PM and story time at 7 PM. They'll love it!",
    "The children have a great day ahead - learning games this afternoon and bedtime stories tonight."
  ],
  'music': [
    "I'd love to play some family-friendly music! What genre would you prefer?",
    "Let's play some music! I have classical, children's songs, or relaxing ambient sounds.",
    "Music time! I can play educational songs, classical music, or nature sounds.",
    "Great idea! I can play classical music, children's songs, or relaxing sounds. What mood are you in?",
    "Music sounds perfect! Would you like something energetic, relaxing, or educational for the kids?"
  ],
  'help': [
    "I can help with scheduling, weather, time, children's activities, music, and general questions. What interests you?",
    "I'm here to assist with family scheduling, entertainment, education, and daily tasks. How can I help?",
    "My capabilities include voice interaction, scheduling, child-safe content, and family assistance. What would you like to try?",
    "I'm your family assistant! I can help with schedules, weather, kids' activities, music, and more. What do you need?",
    "I'm here to help with all sorts of family needs - scheduling, entertainment, education, and daily tasks. What can I do for you?"
  ],
  'default': [
    "That's interesting! I'm still learning. Could you try asking about weather, time, schedule, or kids' activities?",
    "I'm not sure about that yet, but I'm always learning! Try asking about the weather, time, or family activities.",
    "I didn't quite understand that. I can help with weather, scheduling, children's activities, and more. What would you like to know?",
    "I'm still learning about that topic. I'm great with weather, time, schedules, and family activities. What would you like to try?",
    "That's a new one for me! I'm best with weather updates, time, scheduling, and kids' activities. What interests you most?"
  ]
};

// Get random response with better matching
function getResponse(input) {
  const lowerInput = input.toLowerCase().trim();
  console.log('Processing input:', lowerInput);
  
  // More flexible matching
  let key = 'default';
  
  if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
    key = 'hello';
  } else if (lowerInput.includes('weather') || lowerInput.includes('temperature') || lowerInput.includes('sunny') || lowerInput.includes('rain')) {
    key = 'weather';
  } else if (lowerInput.includes('time') || lowerInput.includes('clock') || lowerInput.includes('hour')) {
    key = 'time';
  } else if (lowerInput.includes('schedule') || lowerInput.includes('calendar') || lowerInput.includes('appointment') || lowerInput.includes('meeting')) {
    key = 'schedule';
  } else if (lowerInput.includes('kid') || lowerInput.includes('child') || lowerInput.includes('children') || lowerInput.includes('family')) {
    key = 'kids';
  } else if (lowerInput.includes('music') || lowerInput.includes('song') || lowerInput.includes('play') || lowerInput.includes('sound')) {
    key = 'music';
  } else if (lowerInput.includes('help') || lowerInput.includes('what can you') || lowerInput.includes('assist')) {
    key = 'help';
  }
  
  const responseArray = responses[key];
  const selectedResponse = responseArray[Math.floor(Math.random() * responseArray.length)];
  
  console.log('Selected key:', key, 'Response:', selectedResponse);
  return selectedResponse;
}

// Add to conversation history
function addToHistory(type, message, timestamp = new Date()) {
  conversationHistory.push({
    type,
    message,
    timestamp: timestamp.toISOString(),
    user: currentUser
  });
  
  // Keep only last 20 conversations
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-20);
  }
}

// Interactive web interface with voice simulation
const interactiveWebInterface = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Jetson Home Assistant</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .logo { font-size: 3em; margin-bottom: 10px; }
        .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { 
            background: rgba(255,255,255,0.1); 
            padding: 20px; 
            border-radius: 15px; 
            backdrop-filter: blur(10px); 
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease;
        }
        .card:hover { transform: translateY(-5px); }
        .card h3 { margin: 0 0 15px 0; color: #fff; display: flex; align-items: center; }
        .card h3 .icon { margin-right: 10px; font-size: 1.2em; }
        .status-item { display: flex; justify-content: space-between; margin: 8px 0; }
        .status-healthy { color: #4ade80; font-weight: bold; }
        .status-warning { color: #fbbf24; }
        
        .voice-interface {
            background: rgba(255,255,255,0.15);
            padding: 30px;
            border-radius: 20px;
            margin: 30px 0;
            text-align: center;
            border: 2px solid rgba(255,255,255,0.3);
        }
        
        .voice-button {
            background: linear-gradient(45deg, #ff6b6b, #ee5a24);
            border: none;
            border-radius: 50%;
            width: 100px;
            height: 100px;
            color: white;
            font-size: 2em;
            cursor: pointer;
            margin: 20px;
            transition: all 0.3s ease;
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        
        .voice-button:hover { 
            transform: scale(1.1); 
            box-shadow: 0 12px 35px rgba(0,0,0,0.4);
        }
        
        .voice-button.listening {
            background: linear-gradient(45deg, #4ade80, #22c55e);
            animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .conversation {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 15px;
            margin: 20px 0;
            max-height: 400px;
            overflow-y: auto;
        }
        
        .message {
            margin: 15px 0;
            padding: 12px 18px;
            border-radius: 20px;
            max-width: 80%;
            word-wrap: break-word;
        }
        
        .user-message {
            background: linear-gradient(45deg, #667eea, #764ba2);
            margin-left: auto;
            text-align: right;
        }
        
        .assistant-message {
            background: linear-gradient(45deg, #4ade80, #22c55e);
            margin-right: auto;
        }
        
        .text-input {
            width: 70%;
            padding: 15px;
            border: none;
            border-radius: 25px;
            font-size: 16px;
            margin: 10px;
            background: rgba(255,255,255,0.9);
            color: #333;
        }
        
        .send-button {
            background: linear-gradient(45deg, #667eea, #764ba2);
            color: white;
            border: none;
            padding: 15px 25px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
            transition: all 0.3s ease;
        }
        
        .send-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }
        
        .quick-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            justify-content: center;
            margin: 20px 0;
        }
        
        .quick-action {
            background: rgba(255,255,255,0.2);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 20px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 14px;
        }
        
        .quick-action:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
        
        .avatar-display {
            width: 150px;
            height: 150px;
            border-radius: 50%;
            background: linear-gradient(45deg, #4ade80, #22c55e);
            margin: 20px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 4em;
            animation: gentle-bounce 3s ease-in-out infinite;
        }
        
        @keyframes gentle-bounce {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
        }
        
        .speaking {
            animation: speaking-animation 0.5s ease-in-out infinite alternate;
        }
        
        @keyframes speaking-animation {
            0% { transform: scale(1); }
            100% { transform: scale(1.05); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🏠🤖</div>
            <h1>Interactive Jetson Home Assistant</h1>
            <p>Virtual Jetson Nano Orin with Voice Interaction</p>
        </div>
        
        <div class="voice-interface">
            <div class="avatar-display" id="avatar">🤖</div>
            <h2>Voice Assistant Ready</h2>
            <p>Click the microphone to start talking, or type your message below</p>
            
            <button class="voice-button" id="voiceButton" onclick="toggleVoiceInput()">
                🎤
            </button>
            
            <div>
                <input type="text" class="text-input" id="textInput" placeholder="Type your message here..." onkeypress="handleKeyPress(event)">
                <button class="send-button" onclick="sendTextMessage()">Send</button>
            </div>
            
            <div class="quick-actions">
                <button class="quick-action" onclick="quickMessage('hello')">👋 Say Hello</button>
                <button class="quick-action" onclick="quickMessage('weather')">🌤️ Weather</button>
                <button class="quick-action" onclick="quickMessage('time')">🕐 Time</button>
                <button class="quick-action" onclick="quickMessage('schedule')">📅 Schedule</button>
                <button class="quick-action" onclick="quickMessage('kids')">👶 Kids Activities</button>
                <button class="quick-action" onclick="quickMessage('music')">🎵 Play Music</button>
            </div>
        </div>
        
        <div class="conversation" id="conversation">
            <div class="message assistant-message">
                👋 Hello Shervin! I'm your virtual home assistant. I can help with scheduling, weather, children's activities, and more. Try talking to me or click the quick action buttons!
            </div>
        </div>
        
        <div class="status-grid">
            <div class="card">
                <h3><span class="icon">🖥️</span>System Status</h3>
                <div class="status-item">
                    <span>Platform:</span>
                    <span class="status-healthy">Jetson Nano Orin (Virtual)</span>
                </div>
                <div class="status-item">
                    <span>Memory:</span>
                    <span class="status-healthy">2.1GB / 8GB (26%)</span>
                </div>
                <div class="status-item">
                    <span>Voice System:</span>
                    <span class="status-healthy">Active & Ready</span>
                </div>
            </div>
            
            <div class="card">
                <h3><span class="icon">🎤</span>Voice System</h3>
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
                <h3><span class="icon">👤</span>Avatar System</h3>
                <div class="status-item">
                    <span>Rendering:</span>
                    <span class="status-healthy">3D Real-time</span>
                </div>
                <div class="status-item">
                    <span>Expressions:</span>
                    <span class="status-healthy">Emotional AI</span>
                </div>
                <div class="status-item">
                    <span>Lip Sync:</span>
                    <span class="status-healthy">Active</span>
                </div>
            </div>
            
            <div class="card">
                <h3><span class="icon">🛡️</span>Safety Systems</h3>
                <div class="status-item">
                    <span>Child Safety:</span>
                    <span class="status-healthy">COPPA Compliant</span>
                </div>
                <div class="status-item">
                    <span>Content Filter:</span>
                    <span class="status-healthy">Strict Mode</span>
                </div>
                <div class="status-item">
                    <span>Family Mode:</span>
                    <span class="status-healthy">Active</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        let isListening = false;
        let recognition = null;
        let speechSynthesis = window.speechSynthesis;
        
        // Initialize speech recognition if available
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            
            recognition.onresult = function(event) {
                const transcript = event.results[0][0].transcript;
                handleUserInput(transcript, true);
            };
            
            recognition.onerror = function(event) {
                console.log('Speech recognition error:', event.error);
                stopListening();
            };
            
            recognition.onend = function() {
                stopListening();
            };
        }
        
        function toggleVoiceInput() {
            if (isListening) {
                stopListening();
            } else {
                startListening();
            }
        }
        
        function startListening() {
            if (!recognition) {
                // Fallback for browsers without speech recognition
                alert('Speech recognition not supported in this browser. Please use the text input instead.');
                return;
            }
            
            isListening = true;
            const button = document.getElementById('voiceButton');
            const avatar = document.getElementById('avatar');
            
            button.classList.add('listening');
            button.innerHTML = '🔴';
            avatar.style.animation = 'pulse 1s infinite';
            
            recognition.start();
        }
        
        function stopListening() {
            isListening = false;
            const button = document.getElementById('voiceButton');
            const avatar = document.getElementById('avatar');
            
            button.classList.remove('listening');
            button.innerHTML = '🎤';
            avatar.style.animation = 'gentle-bounce 3s ease-in-out infinite';
            
            if (recognition) {
                recognition.stop();
            }
        }
        
        function handleKeyPress(event) {
            if (event.key === 'Enter') {
                sendTextMessage();
            }
        }
        
        function sendTextMessage() {
            const input = document.getElementById('textInput');
            const message = input.value.trim();
            if (message) {
                handleUserInput(message, false);
                input.value = '';
            }
        }
        
        function quickMessage(type) {
            const messages = {
                'hello': 'Hello!',
                'weather': 'What\\'s the weather like?',
                'time': 'What time is it?',
                'schedule': 'What\\'s on my schedule?',
                'kids': 'What activities do the kids have?',
                'music': 'Can you play some music?'
            };
            
            handleUserInput(messages[type] || type, false);
        }
        
        async function handleUserInput(message, isVoice) {
            // Add user message to conversation
            addMessageToConversation(message, 'user');
            
            // Show thinking state
            const avatar = document.getElementById('avatar');
            avatar.innerHTML = '🤔';
            
            try {
                console.log('Sending message:', message, 'isVoice:', isVoice);
                
                // Send to backend
                const response = await fetch('/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        message: message,
                        isVoice: isVoice,
                        user: 'Shervin'
                    })
                });
                
                console.log('Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error('HTTP ' + response.status + ': ' + response.statusText);
                }
                
                const data = await response.json();
                console.log('Response data:', data);
                
                // Add assistant response to conversation
                addMessageToConversation(data.response, 'assistant');
                
                // Speak the response if voice was used or if requested
                if (isVoice || data.shouldSpeak) {
                    speakText(data.response);
                }
                
            } catch (error) {
                console.error('Error processing message:', error);
                const errorMessage = 'I had trouble processing that. Error: ' + error.message + '. Please try again or use the text input.';
                addMessageToConversation(errorMessage, 'assistant');
                
                // Speak error message if it was a voice input
                if (isVoice) {
                    speakText("Sorry, I had trouble understanding that. Please try speaking again or use the text input.");
                }
            }
            
            // Reset avatar
            avatar.innerHTML = '🤖';
        }
        
        function addMessageToConversation(message, type) {
            const conversation = document.getElementById('conversation');
            const messageDiv = document.createElement('div');
            messageDiv.className = \`message \${type}-message\`;
            messageDiv.textContent = (type === 'user' ? '👤 ' : '🤖 ') + message;
            
            conversation.appendChild(messageDiv);
            conversation.scrollTop = conversation.scrollHeight;
        }
        
        function speakText(text) {
            if (speechSynthesis) {
                // Cancel any ongoing speech
                speechSynthesis.cancel();
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                
                // Find a good voice (prefer female voices for friendliness)
                const voices = speechSynthesis.getVoices();
                const preferredVoice = voices.find(voice => 
                    voice.name.includes('Female') || 
                    voice.name.includes('Samantha') || 
                    voice.name.includes('Karen') ||
                    voice.name.includes('Zira')
                ) || voices[0];
                
                if (preferredVoice) {
                    utterance.voice = preferredVoice;
                }
                
                const avatar = document.getElementById('avatar');
                
                utterance.onstart = function() {
                    avatar.classList.add('speaking');
                    avatar.innerHTML = '🗣️';
                };
                
                utterance.onend = function() {
                    avatar.classList.remove('speaking');
                    avatar.innerHTML = '🤖';
                };
                
                speechSynthesis.speak(utterance);
            }
        }
        
        // Load voices when they become available
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = function() {
                // Voices loaded
            };
        }
        
        // Auto-refresh status every 30 seconds
        setInterval(async function() {
            try {
                const response = await fetch('/status');
                const data = await response.json();
                // Update status display if needed
            } catch (error) {
                console.log('Status update failed:', error);
            }
        }, 30000);
        
        // Welcome message
        setTimeout(function() {
            if (speechSynthesis && speechSynthesis.getVoices().length > 0) {
                speakText("Hello Shervin! I'm your virtual home assistant. How can I help you today?");
            }
        }, 2000);
    </script>
</body>
</html>`;

// Create HTTP server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
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
      res.end(interactiveWebInterface);
      break;
      
    case '/health':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthData, null, 2));
      break;
      
    case '/status':
      // Update timestamp and uptime
      healthData.timestamp = new Date().toISOString();
      healthData.uptime = process.uptime();
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...healthData,
        conversationHistory: conversationHistory.slice(-5), // Last 5 conversations
        features: {
          voiceRecognition: 'Whisper (Local)',
          textToSpeech: 'Neural TTS',
          wakeWordDetection: 'Porcupine',
          avatarRendering: '3D Real-time',
          childSafety: 'COPPA Compliant',
          parentalControls: 'Active',
          interactiveMode: 'Enabled'
        }
      }, null, 2));
      break;
      
    case '/chat':
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        
        req.on('end', () => {
          try {
            console.log('Received chat request body:', body);
            const { message, isVoice, user } = JSON.parse(body);
            
            console.log('Parsed message:', message, 'isVoice:', isVoice, 'user:', user);
            
            if (!message || typeof message !== 'string') {
              throw new Error('Invalid message format');
            }
            
            // Add user message to history
            addToHistory('user', message);
            
            // Generate response
            const response = getResponse(message);
            
            // Add assistant response to history
            addToHistory('assistant', response);
            
            const responseData = {
              response: response,
              shouldSpeak: isVoice || message.toLowerCase().includes('speak') || message.toLowerCase().includes('say'),
              timestamp: new Date().toISOString(),
              conversationId: conversationHistory.length,
              success: true
            };
            
            console.log('Sending response:', responseData);
            
            // Send response
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(responseData));
            
          } catch (error) {
            console.error('Chat endpoint error:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: 'Invalid request body',
              details: error.message,
              success: false
            }));
          }
        });
        
        req.on('error', (error) => {
          console.error('Request error:', error);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Server error',
            details: error.message,
            success: false
          }));
        });
      } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      }
      break;
      
    case '/conversation':
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        history: conversationHistory,
        currentUser: currentUser,
        isListening: isListening
      }));
      break;
      
    default:
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path: url.pathname }));
  }
});

// Start servers
const API_PORT = 3001; // Use different port to avoid conflict
const WEB_PORT = 8081;  // Use different port to avoid conflict

// API Server
server.listen(API_PORT, () => {
  console.log(`✅ Interactive API Server running on http://localhost:${API_PORT}`);
  console.log(`   Health: http://localhost:${API_PORT}/health`);
  console.log(`   Status: http://localhost:${API_PORT}/status`);
  console.log(`   Chat: http://localhost:${API_PORT}/chat`);
});

// Web Server (same server, different port)
const webServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(interactiveWebInterface);
});

webServer.listen(WEB_PORT, () => {
  console.log(`✅ Interactive Web Interface running on http://localhost:${WEB_PORT}`);
});

console.log('');
console.log('🎉 Interactive Virtual Jetson Home Assistant is running!');
console.log('📱 Interactive Web Interface: http://localhost:8081');
console.log('🔌 API Health: http://localhost:3001/health');
console.log('📊 API Status: http://localhost:3001/status');
console.log('💬 Chat API: http://localhost:3001/chat');
console.log('');
console.log('🎤 Features:');
console.log('  • Voice Recognition (browser-based)');
console.log('  • Text-to-Speech responses');
console.log('  • Interactive conversation');
console.log('  • Quick action buttons');
console.log('  • Real-time avatar animations');
console.log('  • Family-safe responses');
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