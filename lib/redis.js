/**
 * lib/redis.js
 *
 * Redis clients, in plain CommonJS so `server.js` can require it directly —
 * it cannot load the TypeScript modules at runtime.
 *
 * Two separate clients on purpose:
 *
 *  - the queue client is handed to BullMQ, which issues blocking commands
 *    (BRPOPLPUSH and friends) and duplicates the connection for its workers;
 *  - the presence client serves the notification routing reads and writes.
 *
 * Sharing one client between them would put ordinary GET/ZADD traffic behind
 * BullMQ's blocking calls.
 */

const IORedis = require('ioredis')

const REDIS_URL = () => process.env.REDIS_URL || 'redis://localhost:6379'

/** @type {import('ioredis').Redis | null} */
let queueClient = null
/** @type {import('ioredis').Redis | null} */
let presenceClient = null

function create(label, options) {
  const client = new IORedis(REDIS_URL(), options)
  client.on('error', err => {
    console.warn(`[Redis:${label}] ${err.message}`)
  })
  return client
}

/**
 * Connection for BullMQ. `maxRetriesPerRequest: null` is required by BullMQ.
 * @returns {import('ioredis').Redis}
 */
function getQueueRedis() {
  if (!queueClient) {
    queueClient = create('queue', {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  }
  return queueClient
}

/**
 * Connection for presence. Bounded retries and a short timeout, because a
 * notification must not stall waiting on soft state — callers treat a failure
 * as "not present" and deliver anyway.
 * @returns {import('ioredis').Redis}
 */
function getPresenceRedis() {
  if (!presenceClient) {
    presenceClient = create('presence', {
      maxRetriesPerRequest: 2,
      enableReadyCheck: false,
      lazyConnect: true,
      commandTimeout: 1500,
    })
  }
  return presenceClient
}

/**
 * Dedicated pair for the Socket.IO cluster adapter.
 *
 * A connection in subscriber mode cannot serve ordinary commands, so the
 * subscriber must be its own socket — it cannot be shared with the queue or
 * presence clients. Not lazy, because the adapter subscribes during startup.
 *
 * @returns {{ pubClient: import('ioredis').Redis, subClient: import('ioredis').Redis }}
 */
function createSocketAdapterClients() {
  const pubClient = create('socket-pub', {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
  const subClient = pubClient.duplicate()
  subClient.on('error', err => {
    console.warn(`[Redis:socket-sub] ${err.message}`)
  })
  return { pubClient, subClient }
}

module.exports = { getQueueRedis, getPresenceRedis, createSocketAdapterClients }
