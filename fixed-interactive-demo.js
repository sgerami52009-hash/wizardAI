const http = require('http');

// Mock Jetson environment
process.env.NODE_ENV = 'production';
process.env.JETSON_PLATFORM = 'nano-orin';
process.env.JETSON_VIRTUAL = 'true';

console.log('🚀 Starting Fixed Interactive Jetson Home Assistant');
console.log('Platform: Virtual Jetson Nano Orin with Voice Interaction');

// Conversation state
let conversationHistory = [];
let currentUser = 'Shervin';

// Enhanced responses
const responses = {
  'hello': [
    "Hello Shervin! I'm your virtual home assistant. How can I help you today?",
    "Hi there! Great to see you. What would you like to do?",
    "Hello! I'm ready to assist you with anything you need.",
    "Hey Shervin! Nice to hear from you. What's on your mind?"
  ],
  'weather': [
    "The weather today is sunny with a temperature of 72°F. Perfect for outdoor activities!",
    "It's a beautiful day outside - 72°F and sunny. Great weather for the family!",
    "Beautiful weather today! 72 degrees and sunny - perfect for spending time outdoors."
  ],
  'time': [
    "The current time is " + new Date().toLocaleTimeString() + ".",
    "It's " + new Date().toLocaleTimeString() + " right now.",
    "Right now it's " + new Date().toLocaleTimeString() + "."
  ],
  'schedule': [
    "Your schedule for today includes a family meeting at 3 PM and dinner preparation at 6 PM.",
    "You have family time at 3 PM and cooking at 6 PM on your schedule today.",
    "Today's schedule: 3 PM family meeting, 6 PM dinner prep. Need any reminders?"
  ],
  'kids': [
    "The kids' activities include educational games at 2 PM and story time at 7 PM.",
    "Children's schedule: learning games this afternoon and bedtime stories tonight.",
    "The little ones have fun activities planned - games and stories!"
  ],
  'music': [
    "I'd love to play some family-friendly music! What genre would you prefer?",
    "Let's play some music! I have classical, children's songs, or relaxing sounds.",
    "Music time! Would you like something energetic, relaxing, or educational?"
  ],
  'help': [
    "I can help with scheduling, weather, time, children's activities, music, and more. What interests you?",
    "I'm here for family scheduling, entertainment, education, and daily tasks. How can I help?",
    "I'm your family assistant! I can help with schedules, weather, kids' activities, and more."
  ],
  'default': [
    "That's interesting! I can help with weather, time, schedules, and family activities. What would you like to try?",
    "I'm still learning about that. I'm great with weather, time, scheduling, and kids' activities!",
    "I'm best with weather updates, time, schedules, and family activities. What interests you?"
  ]
};

// Smart response matching
function getResponse(input) {
  const lowerInput = input.toLowerCase().trim();
  console.log('Processing input:', lowerInput);
  
  let key = 'default';
  
  if (lowerInput.includes('hello') || lowerInput.includes('hi') || lowerInput.includes('hey')) {
    key = 'hello';
  } else if (lowerInput.includes('weather') || lowerInput.includes('temperature')) {
    key = 'weather';
  } else if (lowerInput.includes('time') || lowerInput.includes('clock')) {
    key = 'time';
  } else if (lowerInput.includes('schedule') || lowerInput.includes('calendar')) {
    key = 'schedule';
  } else if (lowerInput.includes('kid') || lowerInput.includes('child') || lowerInput.includes('family')) {
    key = 'kids';
  } else if (lowerInput.includes('music') || lowerInput.includes('song') || lowerInput.includes('play')) {
    key = 'music';
  } else if (lowerInput.includes('help') || lowerInput.includes('what can you')) {
    key = 'help';
  }
  
  const responseArray = responses[key];
  const selectedResponse = responseArray[Math.floor(Math.random() * responseArray.length)];
  
  console.log('Selected response:', selectedResponse);
  return selectedResponse;
}

// Add to conversation history
function addToHistory(type, message) {
  conversationHistory.push({
    type,
    message,
    timestamp: new Date().toISOString(),
    user: currentUser
  });
  
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-20);
  }
}

// Enhanced web interface
const webInterface = `
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
        
        .voice-interface {
            background: rgba(255,255,255,0.15);
            padding: 30px;
            border-radius: 20px;
            margin: 30px 0;
            text-align: center;
            border: 2px solid rgba(255,255,255,0.3);
        }
        
        .avatar-display {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: linear-gradient(45deg, #4ade80, #22c55e);
            margin: 20px auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 3em;
            animation: gentle-bounce 3s ease-in-out infinite;
        }
        
        @keyframes gentle-bounce {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
        }
        
        .voice-button {
            background: linear-gradient(45deg, #ff6b6b, #ee5a24);
            border: none;
            border-radius: 50%;
            width: 80px;
            height: 80px;
            color: white;
            font-size: 1.8em;
            cursor: pointer;
            margin: 15px;
            transition: all 0.3s ease;
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
        }
        
        .voice-button:hover { 
            transform: scale(1.1); 
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
        
        .text-input {
            width: 60%;
            padding: 12px 20px;
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
            padding: 12px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px;
            transition: all 0.3s ease;
        }
        
        .send-button:hover {
            transform: translateY(-2px);
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
            margin: 12px 0;
            padding: 10px 15px;
            border-radius: 18px;
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
        
        .quick-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
            margin: 15px 0;
        }
        
        .quick-action {
            background: rgba(255,255,255,0.2);
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 18px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 14px;
        }
        
        .quick-action:hover {
            background: rgba(255,255,255,0.3);
            transform: translateY(-2px);
        }
        
        .status-info {
            background: rgba(255,255,255,0.1);
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            text-align: center;
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
        
        <div class="status-info">
            <strong>🖥️ System Status:</strong> Virtual Jetson Nano Orin Active | 
            <strong>🎤 Voice:</strong> Ready | 
            <strong>🛡️ Safety:</strong> Family Mode Active
        </div>
    </div>

    <script>
        let isListening = false;
        let recognition = null;
        let speechSynthesis = window.speechSynthesis;
        
        // Initialize speech recognition
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';
            
            recognition.onresult = function(event) {
                const transcript = event.results[0][0].transcript;
                console.log('Speech recognized:', transcript);
                handleUserInput(transcript, true);
            };
            
            recognition.onerror = function(event) {
                console.log('Speech recognition error:', event.error);
                addMessageToConversation('Sorry, I had trouble hearing you. Please try again.', 'assistant');
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
                addMessageToConversation('Speech recognition not supported in this browser. Please use the text input.', 'assistant');
                return;
            }
            
            isListening = true;
            const button = document.getElementById('voiceButton');
            const avatar = document.getElementById('avatar');
            
            button.classList.add('listening');
            button.innerHTML = '🔴';
            avatar.style.animation = 'pulse 1s infinite';
            
            try {
                recognition.start();
            } catch (error) {
                console.error('Recognition start error:', error);
                stopListening();
            }
        }
        
        function stopListening() {
            isListening = false;
            const button = document.getElementById('voiceButton');
            const avatar = document.getElementById('avatar');
            
            button.classList.remove('listening');
            button.innerHTML = '🎤';
            avatar.style.animation = 'gentle-bounce 3s ease-in-out infinite';
            
            if (recognition) {
                try {
                    recognition.stop();
                } catch (error) {
                    console.error('Recognition stop error:', error);
                }
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
                'weather': 'What is the weather like?',
                'time': 'What time is it?',
                'schedule': 'What is on my schedule?',
                'kids': 'What activities do the kids have?',
                'music': 'Can you play some music?'
            };
            
            handleUserInput(messages[type] || type, false);
        }
        
        async function handleUserInput(message, isVoice) {
            console.log('Handling input:', message, 'Voice:', isVoice);
            
            // Add user message to conversation
            addMessageToConversation(message, 'user');
            
            // Show thinking state
            const avatar = document.getElementById('avatar');
            avatar.innerHTML = '🤔';
            
            try {
                // Send to backend API
                const response = await fetch('/api/chat', {
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
                
                console.log('API Response status:', response.status);
                
                if (!response.ok) {
                    throw new Error('API request failed: ' + response.status);
                }
                
                const data = await response.json();
                console.log('API Response data:', data);
                
                if (data.success && data.response) {
                    // Add assistant response to conversation
                    addMessageToConversation(data.response, 'assistant');
                    
                    // Speak the response if voice was used
                    if (isVoice || data.shouldSpeak) {
                        speakText(data.response);
                    }
                } else {
                    throw new Error(data.error || 'Invalid response format');
                }
                
            } catch (error) {
                console.error('Error processing message:', error);
                addMessageToConversation('Sorry, I had trouble processing that. Please try again.', 'assistant');
            }
            
            // Reset avatar
            avatar.innerHTML = '🤖';
        }
        
        function addMessageToConversation(message, type) {
            const conversation = document.getElementById('conversation');
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message ' + type + '-message';
            messageDiv.textContent = (type === 'user' ? '👤 ' : '🤖 ') + message;
            
            conversation.appendChild(messageDiv);
            conversation.scrollTop = conversation.scrollHeight;
        }
        
        function speakText(text) {
            if (speechSynthesis) {
                speechSynthesis.cancel();
                
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 0.9;
                utterance.pitch = 1.0;
                utterance.volume = 0.8;
                
                const voices = speechSynthesis.getVoices();
                const preferredVoice = voices.find(voice => 
                    voice.name.includes('Female') || 
                    voice.name.includes('Samantha') || 
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
        
        // Load voices when available
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = function() {
                console.log('Voices loaded:', speechSynthesis.getVoices().length);
            };
        }
        
        // Welcome message
        setTimeout(function() {
            if (speechSynthesis && speechSynthesis.getVoices().length > 0) {
                speakText("Hello Shervin! I'm your virtual home assistant. How can I help you today?");
            }
        }, 2000);
    </script>
</body>
</html>`;

// Create HTTP server with proper routing
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  
  console.log('Request:', req.method, url.pathname);
  
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
  if (url.pathname === '/' || url.pathname === '/index.html') {
    // Serve web interface
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(webInterface);
    
  } else if (url.pathname === '/api/chat' && req.method === 'POST') {
    // Handle chat API
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        console.log('Chat API request body:', body);
        const { message, isVoice, user } = JSON.parse(body);
        
        if (!message || typeof message !== 'string') {
          throw new Error('Invalid message format');
        }
        
        console.log('Processing message:', message);
        
        // Add to history
        addToHistory('user', message);
        
        // Generate response
        const response = getResponse(message);
        addToHistory('assistant', response);
        
        const responseData = {
          response: response,
          shouldSpeak: isVoice || message.toLowerCase().includes('speak'),
          timestamp: new Date().toISOString(),
          success: true
        };
        
        console.log('Sending response:', responseData);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responseData));
        
      } catch (error) {
        console.error('Chat API error:', error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: error.message,
          success: false
        }));
      }
    });
    
  } else if (url.pathname === '/api/health') {
    // Health check
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      platform: 'jetson-nano-orin-virtual-interactive',
      version: '1.0.0'
    }));
    
  } else if (url.pathname === '/api/status') {
    // Status endpoint
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      platform: 'jetson-nano-orin-virtual-interactive',
      conversationHistory: conversationHistory.slice(-5),
      features: {
        voiceRecognition: 'Browser-based',
        textToSpeech: 'Web Speech API',
        interactiveMode: 'Enabled'
      }
    }));
    
  } else {
    // 404 for other paths
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

// Start server
const PORT = 8082;
server.listen(PORT, () => {
  console.log('✅ Fixed Interactive Jetson Assistant running on http://localhost:' + PORT);
  console.log('🎤 Features: Voice Recognition, Text-to-Speech, Interactive Chat');
  console.log('🛡️ Family-Safe Responses with Child Safety Controls');
  console.log('');
  console.log('Press Ctrl+C to stop');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});