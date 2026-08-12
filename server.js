const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      
      // Let Socket.io handle its own requests
      if (parsedUrl.pathname && parsedUrl.pathname.startsWith('/api/socket.io')) {
        return;
      }
      
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.io
  const io = new Server(server, {
    path: '/api/socket.io',
    cors: {
      origin: '*', // Adjust this for production
      methods: ['GET', 'POST']
    }
  });

  // Expose io globally so the notification engine can emit to user rooms
  global.__socketIo = io;

  const activeUsers = new Map(); // socketId -> userId

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // When a user connects and identifies themselves
    socket.on('user:online', (userId) => {
      activeUsers.set(socket.id, userId);
      // Broadcast to all that this user is online
      io.emit('user:presence', { userId, status: 'online' });
    });

    // Join user's personal notification room
    socket.on('notifications:join', (userId) => {
      socket.join(`notif:${userId}`);
      console.log(`[Socket] Socket ${socket.id} joined notification room for user ${userId}`);
    });

    // Join a specific conversation room (e.g., DM or Project channel)
    socket.on('conversation:join', (conversationId) => {
      socket.join(conversationId);
      console.log(`[Socket] Socket ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(conversationId);
      console.log(`[Socket] Socket ${socket.id} left conversation ${conversationId}`);
    });

    socket.on('message:send', (data) => {
      console.log(`[Socket] Received message:send for conv ${data.conversation_id || data.conversationId}`);
      const roomId = data.conversation_id || data.conversationId;
      io.to(roomId).emit('message:new', data);
      console.log(`[Socket] Emitted message:new to room ${roomId}`);
    });

    // Message edit
    socket.on('message:edit', (data) => {
      const roomId = data.conversation_id || data.conversationId;
      io.to(roomId).emit('message:edited', data);
    });

    // Message delete
    socket.on('message:delete', (data) => {
      const roomId = data.conversation_id || data.conversationId;
      io.to(roomId).emit('message:deleted', data);
    });

    // Thread reply
    socket.on('thread:reply', (data) => {
      const roomId = data.conversation_id || data.conversationId;
      io.to(roomId).emit('thread:new-reply', data);
    });

    // Message reaction
    socket.on('message:react', (data) => {
      const roomId = data.conversation_id || data.conversationId;
      io.to(roomId).emit('message:reacted', data);
    });

    // Typing indicators
    socket.on('typing:start', (data) => {
      socket.to(data.conversationId).emit('typing:update', { userId: data.userId, isTyping: true });
    });

    socket.on('typing:stop', (data) => {
      socket.to(data.conversationId).emit('typing:update', { userId: data.userId, isTyping: false });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      const userId = activeUsers.get(socket.id);
      if (userId) {
        activeUsers.delete(socket.id);
        
        // Check if user has other active sockets before marking completely offline
        let isStillOnline = false;
        for (const [sId, uId] of activeUsers.entries()) {
          if (uId === userId) {
            isStillOnline = true;
            break;
          }
        }
        
        if (!isStillOnline) {
          io.emit('user:presence', { userId, status: 'offline' });
        }
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io server running`);

    // BullMQ notification workers are now started inside Next.js instrumentation.ts
  });
}).catch((err) => {
  console.error('Error starting Next.js app', err);
  process.exit(1);
});
console.log('Testing custom server file');
