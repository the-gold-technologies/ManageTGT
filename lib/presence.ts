/**
 * lib/presence.ts
 *
 * Who is where, for notification routing.
 *
 * Redis is the source of truth. Presence used to live in a Map inside
 * server.js, which quietly breaks the moment the app runs more than one process:
 * a socket held by instance A is invisible to a notification dispatched on
 * instance B, so "don't push to their phone, they're reading it on desktop"
 * stops working and everyone gets doubled notifications.
 *
 * The in-process registry is kept as a fallback for when Redis is unreachable,
 * and both paths fail open toward *delivering* the notification. A redundant
 * push is a much smaller problem than silence.
 */

import type { DeviceClass } from './notification-engine'
import { getPresenceRedis } from './redis'
import {
  DESKTOP_ACTIVE_WINDOW_MS,
  VIEWING_WINDOW_MS,
  MOBILE_PUSH_DELAY_MS,
  presenceKey,
  viewingKey,
} from './presence-keys'

export { DESKTOP_ACTIVE_WINDOW_MS, VIEWING_WINDOW_MS, MOBILE_PUSH_DELAY_MS }

// ─── In-process fallback ─────────────────────────────────────────────────────

interface LocalRegistry {
  getViewers(conversationId: string): string[]
  isActiveOn(userId: string, deviceClass: DeviceClass, withinMs: number): boolean
}

function localRegistry(): LocalRegistry | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = (global as any).__presence
  return reg && typeof reg.getViewers === 'function' ? (reg as LocalRegistry) : null
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

/**
 * Everything the routing gates need about one conversation, read in a single
 * round trip rather than once per participant. A channel with twenty members
 * costs the same as a direct message.
 */
export interface PresenceSnapshot {
  /** Users with this conversation open right now. */
  viewers: Set<string>
  /** Users active on a computer inside the activity window. */
  desktopActive: Set<string>
  /** Users active on any device, used to resolve `@here`. */
  online: Set<string>
  /** False when this came from the in-process fallback. */
  fromRedis: boolean
}

const EMPTY_SNAPSHOT: PresenceSnapshot = {
  viewers: new Set(),
  desktopActive: new Set(),
  online: new Set(),
  fromRedis: false,
}

export async function getPresenceSnapshot(conversationId: string): Promise<PresenceSnapshot> {
  const now = Date.now()

  try {
    const redis = getPresenceRedis()
    const [viewers, desktop, mobile] = await Promise.all([
      redis.zrangebyscore(viewingKey(conversationId), now - VIEWING_WINDOW_MS, '+inf'),
      redis.zrangebyscore(presenceKey('desktop'), now - DESKTOP_ACTIVE_WINDOW_MS, '+inf'),
      redis.zrangebyscore(presenceKey('mobile'), now - DESKTOP_ACTIVE_WINDOW_MS, '+inf'),
    ])

    const desktopActive = new Set(desktop)
    return {
      viewers: new Set(viewers),
      desktopActive,
      online: new Set([...desktop, ...mobile]),
      fromRedis: true,
    }
  } catch (err) {
    // Redis down or slow. Fall back to whatever this process knows, which is
    // correct for a single-instance deployment and partial for a cluster.
    console.warn(
      '[Presence] Redis read failed, using in-process fallback:',
      err instanceof Error ? err.message : err,
    )

    const local = localRegistry()
    if (!local) return EMPTY_SNAPSHOT

    try {
      const viewers = local.getViewers(conversationId)
      return {
        viewers: new Set(viewers),
        // The local registry answers per user, so membership is resolved lazily
        // by the helpers below rather than enumerated here.
        desktopActive: new Set(),
        online: new Set(),
        fromRedis: false,
      }
    } catch {
      return EMPTY_SNAPSHOT
    }
  }
}

/**
 * Gate 5, resolved against a snapshot. When the snapshot came from the
 * in-process fallback the sets are not enumerable, so this asks the local
 * registry directly.
 */
export function isActiveOnDesktop(snapshot: PresenceSnapshot, userId: string): boolean {
  if (snapshot.fromRedis) return snapshot.desktopActive.has(userId)
  try {
    return localRegistry()?.isActiveOn(userId, 'desktop', DESKTOP_ACTIVE_WINDOW_MS) ?? false
  } catch {
    return false
  }
}

/** Whether the user has any live device, used to resolve `@here`. */
export function isOnline(snapshot: PresenceSnapshot, userId: string): boolean {
  if (snapshot.fromRedis) return snapshot.online.has(userId)
  try {
    const local = localRegistry()
    if (!local) return false
    return (
      local.isActiveOn(userId, 'desktop', DESKTOP_ACTIVE_WINDOW_MS) ||
      local.isActiveOn(userId, 'mobile', DESKTOP_ACTIVE_WINDOW_MS)
    )
  } catch {
    return false
  }
}

/** Gate 4: is this person looking at the conversation right now? */
export function isViewing(snapshot: PresenceSnapshot, userId: string): boolean {
  return snapshot.viewers.has(userId)
}
