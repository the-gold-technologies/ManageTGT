/**
 * lib/presence-keys.js
 *
 * Shared Redis key names and timing windows for the presence registry.
 *
 * Plain CommonJS because both sides need it: `server.js` (which writes presence
 * as sockets connect and ping) and `lib/presence.ts` (which reads it when
 * routing notifications). Keeping the keys in one place means the writer and the
 * reader cannot drift apart.
 *
 * Presence is modelled as sorted sets keyed by user id with the last-seen
 * timestamp as the score. That gives cross-process reads, cheap "who is active
 * right now" range queries, and pruning without needing per-member TTLs — and it
 * uses only commands every Redis supports, including Upstash, whose pub/sub is
 * too limited to build on.
 */

/** How recently a computer must have reported activity to count as present. */
const DESKTOP_ACTIVE_WINDOW_MS = 2 * 60 * 1000

/**
 * How long a "viewing this conversation" record stays valid. Must comfortably
 * exceed the client ping interval (45s) or an idle reader would appear to leave.
 */
const VIEWING_WINDOW_MS = 90 * 1000

/** How long a mobile push waits while the recipient looks active on a computer. */
const MOBILE_PUSH_DELAY_MS = 3 * 60 * 1000

/** Safety net so abandoned keys cannot accumulate forever. */
const KEY_TTL_SECONDS = 60 * 60

/**
 * Users active on a class of device.
 * @param {'desktop' | 'mobile'} deviceClass
 */
function presenceKey(deviceClass) {
  return `presence:${deviceClass}`
}

/**
 * Users with a conversation open.
 * @param {string} conversationId
 */
function viewingKey(conversationId) {
  return `chat:viewing:${conversationId}`
}

module.exports = {
  DESKTOP_ACTIVE_WINDOW_MS,
  VIEWING_WINDOW_MS,
  MOBILE_PUSH_DELAY_MS,
  KEY_TTL_SECONDS,
  presenceKey,
  viewingKey,
}
