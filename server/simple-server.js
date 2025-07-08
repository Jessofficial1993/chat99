require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);

const corsOrigins = process.env.NODE_ENV === 'production' 
  ? ["https://chat99-app.onrender.com"]
  : ["http://localhost:3000"];

const io = socketIo(server, {
  cors: {
    origin: corsOrigins,
    credentials: true
  }
});

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

app.use(express.json());
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, '../client')));

// Serve the main app
app.get('/', (req, res) => {
  console.log('Serving index.html');
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Add error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send('Something broke!');
});

// Catch all other routes
app.get('*', (req, res) => {
  console.log('Catch-all route for:', req.url);
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// In-memory storage for users and rooms
const users = new Map();
const waitingUsers = [];
const rooms = new Map();

// Socket connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-platform', (data) => {
    try {
      const user = {
        userId: uuidv4(),
        socketId: socket.id,
        username: data.username || `Guest${Math.floor(Math.random() * 10000)}`,
        gender: data.gender,
        isGuest: data.isGuest || false,
        joinedAt: new Date()
      };

      users.set(socket.id, user);
      
      socket.emit('user-registered', user);
      console.log('User registered:', user.username);
      
      // Broadcast updated users list to all clients
      broadcastUsersList();
    } catch (error) {
      console.error('Join platform error:', error);
      socket.emit('error', { message: 'Failed to join platform' });
    }
  });

  socket.on('find-stranger', (data) => {
    try {
      const user = users.get(socket.id);
      if (!user) {
        socket.emit('error', { message: 'User not found' });
        return;
      }

      // Add to waiting list
      waitingUsers.push({
        ...user,
        genderFilter: data.genderFilter || 'any'
      });

      // Try to find a match
      findMatch(socket);
    } catch (error) {
      console.error('Find stranger error:', error);
      socket.emit('error', { message: 'Failed to find stranger' });
    }
  });

  socket.on('send-message', (data) => {
    try {
      const user = users.get(socket.id);
      if (!user || !data.roomId) {
        return;
      }

      const room = rooms.get(data.roomId);
      if (!room || !room.participants.includes(socket.id)) {
        return;
      }

      const message = {
        messageId: uuidv4(),
        senderId: user.userId,
        senderName: user.username,
        message: data.message || '',
        imageUrl: data.imageUrl || null,
        timestamp: new Date()
      };

      // Send to all participants in the room
      room.participants.forEach(participantId => {
        io.to(participantId).emit('new-message', message);
      });

      console.log('Message sent in room:', data.roomId);
    } catch (error) {
      console.error('Send message error:', error);
    }
  });

  socket.on('disconnect', () => {
    try {
      const user = users.get(socket.id);
      if (user) {
        console.log('User disconnected:', user.username);
        
        // Remove from waiting list
        const waitingIndex = waitingUsers.findIndex(u => u.socketId === socket.id);
        if (waitingIndex > -1) {
          waitingUsers.splice(waitingIndex, 1);
        }

        // Handle room disconnection
        rooms.forEach((room, roomId) => {
          if (room.participants.includes(socket.id)) {
            const otherParticipant = room.participants.find(id => id !== socket.id);
            if (otherParticipant) {
              io.to(otherParticipant).emit('stranger-disconnected');
            }
            rooms.delete(roomId);
          }
        });

        users.delete(socket.id);
        
        // Broadcast updated users list
        broadcastUsersList();
      }
    } catch (error) {
      console.error('Disconnect error:', error);
    }
  });

  socket.on('request-users-list', () => {
    sendUsersList(socket);
  });

  socket.on('start-chat-with-user', (data) => {
    try {
      const currentUser = users.get(socket.id);
      if (!currentUser || !data.targetUserId) {
        return;
      }

      // Find target user by userId
      let targetSocket = null;
      for (const [socketId, user] of users.entries()) {
        if (user.userId === data.targetUserId) {
          targetSocket = socketId;
          break;
        }
      }

      if (!targetSocket) {
        socket.emit('error', { message: 'User not found or offline' });
        return;
      }

      // Create room for direct chat
      const roomId = uuidv4();
      const room = {
        roomId,
        participants: [socket.id, targetSocket],
        createdAt: new Date()
      };

      rooms.set(roomId, room);

      // Notify both users
      socket.emit('stranger-found', { roomId });
      io.to(targetSocket).emit('stranger-found', { roomId });

      console.log('Direct chat started:', roomId);
    } catch (error) {
      console.error('Start chat error:', error);
    }
  });
});

function broadcastUsersList() {
  const usersList = Array.from(users.values()).map(user => ({
    userId: user.userId,
    username: user.username,
    gender: user.gender,
    isGuest: user.isGuest,
    joinedAt: user.joinedAt
  }));

  io.emit('users-list-updated', usersList);
}

function sendUsersList(socket) {
  const usersList = Array.from(users.values()).map(user => ({
    userId: user.userId,
    username: user.username,
    gender: user.gender,
    isGuest: user.isGuest,
    joinedAt: user.joinedAt
  }));

  socket.emit('users-list-updated', usersList);
}

function findMatch(socket) {
  const user = users.get(socket.id);
  if (!user) return;

  const currentUserIndex = waitingUsers.findIndex(u => u.socketId === socket.id);
  if (currentUserIndex === -1) return;

  const currentUser = waitingUsers[currentUserIndex];

  // Find a suitable match
  for (let i = 0; i < waitingUsers.length; i++) {
    if (i === currentUserIndex) continue;

    const potential = waitingUsers[i];
    
    // Check if they match each other's preferences
    const userMatches = currentUser.genderFilter === 'any' || potential.gender === currentUser.genderFilter;
    const potentialMatches = potential.genderFilter === 'any' || currentUser.gender === potential.genderFilter;

    if (userMatches && potentialMatches) {
      // Create room
      const roomId = uuidv4();
      const room = {
        roomId,
        participants: [socket.id, potential.socketId],
        createdAt: new Date()
      };

      rooms.set(roomId, room);

      // Remove both users from waiting list
      waitingUsers.splice(Math.max(currentUserIndex, i), 1);
      waitingUsers.splice(Math.min(currentUserIndex, i), 1);

      // Notify both users
      socket.emit('stranger-found', { roomId });
      io.to(potential.socketId).emit('stranger-found', { roomId });

      console.log('Match found:', roomId);
      return;
    }
  }

  // No match found, emit waiting
  socket.emit('waiting-for-stranger');
}

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Chat99 server running on port ${PORT}`);
});