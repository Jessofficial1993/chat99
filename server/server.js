const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
  }
});

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '../client')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat99';
mongoose.connect(MONGODB_URI);

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

const activeUsers = new Map();
const waitingUsers = new Map();
const chatRooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-platform', async (userData) => {
    try {
      let user;
      if (userData.isGuest) {
        user = new User({
          sessionId: socket.id,
          username: userData.username || `Guest${Math.floor(Math.random() * 10000)}`,
          gender: userData.gender,
          isGuest: true,
          isOnline: true
        });
      } else {
        user = await User.findOne({ email: userData.email });
        if (user) {
          user.isOnline = true;
          user.sessionId = socket.id;
        }
      }
      
      await user.save();
      activeUsers.set(socket.id, user);
      socket.emit('user-registered', { userId: user._id, username: user.username });
    } catch (error) {
      socket.emit('error', { message: 'Failed to join platform' });
    }
  });

  socket.on('find-stranger', (preferences) => {
    const currentUser = activeUsers.get(socket.id);
    if (!currentUser) return;

    const genderFilter = preferences.genderFilter;
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
  });

  socket.on('send-message', async (data) => {
    const { roomId, message, imageUrl } = data;
    const room = chatRooms.get(roomId);
    const currentUser = activeUsers.get(socket.id);
    
    if (!room || !currentUser) return;

    const userMessageCount = room.messageCount.get(socket.id) || 0;
    const userCanSend = room.lastReply.get(socket.id);

    if (userMessageCount >= 2 && !userCanSend) {
      socket.emit('message-limit-reached');
      return;
    }

    const newMessage = new Message({
      roomId,
      senderId: currentUser._id,
      senderName: currentUser.username,
      message,
      imageUrl
    });

    await newMessage.save();

    room.messageCount.set(socket.id, userMessageCount + 1);
    
    const otherUserSocketId = room.users.find(id => id !== socket.id);
    room.lastReply.set(otherUserSocketId, true);
    room.lastReply.set(socket.id, false);

    io.to(roomId).emit('new-message', {
      senderId: currentUser._id,
      senderName: currentUser.username,
      message,
      imageUrl,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', async () => {
    const user = activeUsers.get(socket.id);
    if (user) {
      user.isOnline = false;
      user.lastSeen = new Date();
      await user.save();
    }
    
    activeUsers.delete(socket.id);
    waitingUsers.delete(socket.id);
    
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
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'Chat99 server is running!' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Chat99 server running on port ${PORT}`);
});