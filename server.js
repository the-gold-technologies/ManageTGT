const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const {
  presenceKey,
  viewingKey,
  KEY_TTL_SECONDS,
} = require('./lib/presence-keys');

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

  // Route room broadcasts through Redis so they reach sockets held by *other*
  // instances. Without this, `io.to(room).emit(...)` only reaches clients that
  // happen to be connected to this process — so under pm2 cluster mode a chat
  // message would silently reach only some of the people in the conversation.
  //
  // Failure here is not fatal: the app keeps working exactly as it did before,
  // correct on a single instance, so a Redis outage degrades rather than breaks.
  try {
    const { createAdapter } = require('@socket.io/redis-adapter');
    const { createSocketAdapterClients } = require('./lib/redis');
    const { pubClient, subClient } = createSocketAdapterClients();
    io.adapter(createAdapter(pubClient, subClient));
    console.log('> Socket.io using Redis adapter (cluster-safe broadcasts)');
  } catch (err) {
    console.warn(
      '> Socket.io Redis adapter unavailable, broadcasts are single-process only:',
      err.message,
    );
  }

  // Expose io globally so the notification engine can emit to user rooms
  global.__socketIo = io;

  const activeUsers = new Map(); // socketId -> userId

  // userId -> Map<socketId, { deviceClass, lastActiveAt }>
  // Drives the notification suppression rules: which conversation a person is
  // looking at, and whether they are demonstrably present on a computer.
  //
  // Kept as a local fallback only. Redis is the source of truth so that presence
  // survives across pm2 instances — a socket on instance A must be visible to a
  // notification dispatched on instance B, or suppression silently stops working
  // the moment the app runs more than one process.
  const presence = new Map();

  // Reuses the queue's connection helper so there is one Redis client per
  // process rather than a second pool.
  let redis = null;
  try {
    const { getPresenceRedis } = require('./lib/redis');
    redis = getPresenceRedis();
  } catch (err) {
    console.warn('[Presence] Redis unavailable, falling back to in-process presence:', err.message);
  }

  function writePresenceToRedis(userId, deviceClass, conversationId) {
    if (!redis) return;
    const now = Date.now();
    // Fire-and-forget: presence is soft state, and a Redis hiccup must never
    // slow down or break the socket path.
    const pipeline = redis.pipeline();
    pipeline.zadd(presenceKey(deviceClass), now, userId);
    pipeline.expire(presenceKey(deviceClass), KEY_TTL_SECONDS);
    if (conversationId) {
      pipeline.zadd(viewingKey(conversationId), now, userId);
      pipeline.expire(viewingKey(conversationId), KEY_TTL_SECONDS);
    }
    pipeline.exec().catch(err => console.warn('[Presence] write failed:', err.message));
  }

  function clearViewingInRedis(userId, conversationId) {
    if (!redis || !userId || !conversationId) return;
    redis
      .zrem(viewingKey(conversationId), userId)
      .catch(err => console.warn('[Presence] clear viewing failed:', err.message));
  }

  function recordPresence(socket, userId, deviceClass) {
    if (!userId) return;
    socket.data.userId = userId;
    if (deviceClass) socket.data.deviceClass = deviceClass;

    const resolvedClass = socket.data.deviceClass || 'desktop';

    if (!presence.has(userId)) presence.set(userId, new Map());
    presence.get(userId).set(socket.id, {
      deviceClass: resolvedClass,
      lastActiveAt: Date.now(),
    });

    writePresenceToRedis(userId, resolvedClass, socket.data.activeConversationId);
  }

  function clearPresence(socket) {
    const userId = socket.data?.userId;
    if (!userId) return;

    clearViewingInRedis(userId, socket.data.activeConversationId);

    const sockets = presence.get(userId);
    if (!sockets) return;
    sockets.delete(socket.id);
    if (sockets.size === 0) presence.delete(userId);
  }

  // Exposed for server actions and the BullMQ workers, which run in this
  // process. Kept synchronous so the notification path stays cheap.
  global.__presence = {
    /** User ids with a socket currently joined to this conversation's room. */
    getViewers(conversationId) {
      const room = io.sockets.adapter.rooms.get(conversationId);
      if (!room) return [];
      const userIds = new Set();
      for (const socketId of room) {
        const s = io.sockets.sockets.get(socketId);
        if (s?.data?.userId) userIds.add(s.data.userId);
      }
      return [...userIds];
    },

    /** True if the user has a computer socket that saw real activity recently. */
    isActiveOn(userId, deviceClass, withinMs) {
      const sockets = presence.get(userId);
      if (!sockets) return false;
      const cutoff = Date.now() - withinMs;
      for (const info of sockets.values()) {
        if (info.deviceClass === deviceClass && info.lastActiveAt >= cutoff) return true;
      }
      return false;
    },
  };

  io.on('connection', (socket) => {
    console.log('Socket connected:', socket.id);

    // When a user connects and identifies themselves
    socket.on('user:online', (userId) => {
      activeUsers.set(socket.id, userId);
      recordPresence(socket, userId);
      // Broadcast to all that this user is online
      io.emit('user:presence', { userId, status: 'online' });
    });

    // Identifies the device class up front, then keeps liveness fresh. The
    // client only pings while the tab is visible and recently interacted with,
    // so an abandoned open tab stops counting as presence.
    socket.on('presence:hello', ({ userId, deviceClass }) => {
      recordPresence(socket, userId, deviceClass);
    });

    socket.on('presence:ping', ({ userId, deviceClass }) => {
      recordPresence(socket, userId, deviceClass);
    });

    // Join user's personal notification room
    socket.on('notifications:join', (userId) => {
      socket.join(`notif:${userId}`);
      console.log(`[Socket] Socket ${socket.id} joined notification room for user ${userId}`);
    });

    // Join a specific conversation room (e.g., DM or Project channel)
    socket.on('conversation:join', (conversationId) => {
      socket.join(conversationId);
      // Recorded in Redis as well as the socket room, because notification
      // routing may run in a different process from this socket.
      socket.data.activeConversationId = conversationId;
      if (socket.data.userId) {
        writePresenceToRedis(
          socket.data.userId,
          socket.data.deviceClass || 'desktop',
          conversationId,
        );
      }
      console.log(`[Socket] Socket ${socket.id} joined conversation ${conversationId}`);
    });

    socket.on('conversation:leave', (conversationId) => {
      socket.leave(conversationId);
      clearViewingInRedis(socket.data.userId, conversationId);
      if (socket.data.activeConversationId === conversationId) {
        socket.data.activeConversationId = undefined;
      }
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
      clearPresence(socket);
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
