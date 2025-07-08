require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

// Input validation and sanitization
const validator = require('validator');
const xss = require('xss');

const app = express();
const server = http.createServer(app);
// Configure CORS origins
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',') 
  : ["http://localhost:3000", "https://chat99.com"];

const io = socketIo(server, {
  cors: {
    origin: corsOrigins,
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '../client')));

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Chat rate limiting
const chatLimiter = rateLimit({
  windowMs: parseInt(process.env.CHAT_RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: parseInt(process.env.CHAT_RATE_LIMIT_MAX_MESSAGES) || 30,
  message: { error: 'Too many messages, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// Database connection with error handling
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat99';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB successfully');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

const userSchema = new mongoose.Schema({
  sessionId: String,
  username: String,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  isGuest: { type: Boolean, default: true },
  email: String,
  password: String,
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
  currentRoom: String,
  messagesSent: { type: Number, default: 0 },
  messagesReceived: { type: Number, default: 0 }
});

const messageSchema = new mongoose.Schema({
  roomId: String,
  senderId: String,
  senderName: String,
  message: String,
  imageUrl: String,
  timestamp: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Message = mongoose.model('Message', messageSchema);

// In-memory storage
const activeUsers = new Map();
const waitingUsers = new Map();
const chatRooms = new Map();
const userMessageCounts = new Map();

// Input validation functions
function validateMessage(message) {
  if (!message || typeof message !== 'string') return false;
  if (message.length > 500) return false;
  return true;
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') return false;
  if (username.length > 20) return false;
  return validator.isAlphanumeric(username.replace(/[\s_-]/g, ''));
}

function validateGender(gender) {
  return ['male', 'female', 'other'].includes(gender);
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return xss(input.trim());
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-platform', async (userData) => {
    try {
      // Validate input
      if (!userData || typeof userData !== 'object') {
        socket.emit('error', { message: 'Invalid user data' });
        return;
      }

      if (!validateGender(userData.gender)) {
        socket.emit('error', { message: 'Invalid gender selection' });
        return;
      }

      let username = userData.username || `Guest${Math.floor(Math.random() * 10000)}`;
      
      // Validate and sanitize username
      if (userData.username && !validateUsername(userData.username)) {
        socket.emit('error', { message: 'Invalid username' });
        return;
      }
      
      username = sanitizeInput(username);

      const user = new User({
        sessionId: socket.id,
        username: username,
        gender: userData.gender,
        isGuest: true,
        isOnline: true
      });
      
      await user.save();
      activeUsers.set(socket.id, user);
      userMessageCounts.set(socket.id, 0);
      
      socket.emit('user-registered', { userId: user._id, username: user.username });
    } catch (error) {
      console.error('Join platform error:', error);
      socket.emit('error', { message: 'Failed to join platform' });
    }
  });

  socket.on('find-stranger', (preferences) => {
    try {
      const currentUser = activeUsers.get(socket.id);
      if (!currentUser) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Validate preferences
      if (!preferences || typeof preferences !== 'object') {
        socket.emit('error', { message: 'Invalid preferences' });
        return;
      }

      const genderFilter = preferences.genderFilter || 'any';
      if (!['male', 'female', 'other', 'any'].includes(genderFilter)) {
        socket.emit('error', { message: 'Invalid gender filter' });
        return;
      }

      let matchFound = false;

      for (let [waitingSocketId, waitingUser] of waitingUsers) {
        if (waitingUser.gender === genderFilter || genderFilter === 'any') {
          if (currentUser.gender === waitingUser.genderPreference || waitingUser.genderPreference === 'any') {
            const roomId = uuidv4();
            
            waitingUsers.delete(waitingSocketId);
            
            chatRooms.set(roomId, {
              users: [socket.id, waitingSocketId],
              messageCount: new Map([[socket.id, 0], [waitingSocketId, 0]]),
              lastReply: new Map([[socket.id, true], [waitingSocketId, true]])
            });

            socket.join(roomId);
            io.to(waitingSocketId).emit('stranger-found', { roomId });
            socket.emit('stranger-found', { roomId });
            
            matchFound = true;
            break;
          }
        }
      }

      if (!matchFound) {
        waitingUsers.set(socket.id, {
          ...currentUser.toObject(),
          genderPreference: genderFilter
        });
        socket.emit('waiting-for-stranger');
      }
    } catch (error) {
      console.error('Find stranger error:', error);
      socket.emit('error', { message: 'Failed to find stranger' });
    }
  });

  socket.on('send-message', async (data) => {
    try {
      // Validate input
      if (!data || typeof data !== 'object') {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      const { roomId, message, imageUrl } = data;
      const room = chatRooms.get(roomId);
      const currentUser = activeUsers.get(socket.id);
      
      if (!room || !currentUser) {
        socket.emit('error', { message: 'Room or user not found' });
        return;
      }

      // Check rate limiting
      const userGlobalCount = userMessageCounts.get(socket.id) || 0;
      if (userGlobalCount >= 30) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      const userMessageCount = room.messageCount.get(socket.id) || 0;
      const userCanSend = room.lastReply.get(socket.id);

      if (userMessageCount >= 2 && !userCanSend) {
        socket.emit('message-limit-reached');
        return;
      }

      // Validate message content
      if (message && !validateMessage(message)) {
        socket.emit('error', { message: 'Invalid message content' });
        return;
      }

      // Validate image URL if provided
      if (imageUrl && (!validator.isURL(imageUrl) && !imageUrl.startsWith('data:image/'))) {
        socket.emit('error', { message: 'Invalid image URL' });
        return;
      }

      const sanitizedMessage = message ? sanitizeInput(message) : '';

      const newMessage = new Message({
        roomId,
        senderId: currentUser._id,
        senderName: currentUser.username,
        message: sanitizedMessage,
        imageUrl
      });

      await newMessage.save();

      room.messageCount.set(socket.id, userMessageCount + 1);
      userMessageCounts.set(socket.id, userGlobalCount + 1);
      
      const otherUserSocketId = room.users.find(id => id !== socket.id);
      room.lastReply.set(otherUserSocketId, true);
      room.lastReply.set(socket.id, false);

      io.to(roomId).emit('new-message', {
        senderId: currentUser._id,
        senderName: currentUser.username,
        message: sanitizedMessage,
        imageUrl,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', async () => {
    try {
      const user = activeUsers.get(socket.id);
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();
        await user.save();
      }
      
      activeUsers.delete(socket.id);
      waitingUsers.delete(socket.id);
      userMessageCounts.delete(socket.id);
      
      for (let [roomId, room] of chatRooms) {
        if (room.users.includes(socket.id)) {
          const otherUser = room.users.find(id => id !== socket.id);
          if (otherUser) {
            io.to(otherUser).emit('stranger-disconnected');
          }
          chatRooms.delete(roomId);
          break;
        }
      }
      
      console.log('User disconnected:', socket.id);
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Chat99 server is running!',
    timestamp: new Date().toISOString(),
    activeUsers: activeUsers.size,
    waitingUsers: waitingUsers.size,
    chatRooms: chatRooms.size
  });
});

// Stats endpoint
app.get('/api/stats', apiLimiter, (req, res) => {
  res.json({
    activeUsers: activeUsers.size,
    waitingUsers: waitingUsers.size,
    chatRooms: chatRooms.size,
    timestamp: new Date().toISOString()
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Chat99 server running on port ${PORT}`);
});