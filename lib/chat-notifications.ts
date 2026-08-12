/**
 * lib/chat-notifications.ts
 *
 * Decides who gets notified about a chat message, and on which devices.
 *
 * The rules mirror Slack's, which are fundamentally about suppression: each
 * recipient is evaluated through gates ordered cheapest-first, and most
 * messages exit early without touching Redis or the push service.
 *
 *   1. Is the recipient the sender?          -> skip
 *   2. Conversation muted / level NONE?      -> unread badge only
 *   3. DM, mention, keyword, or level ALL?   -> if not, unread badge only
 *   4. Viewing this conversation right now?  -> in-app update only
 *   5. Active on a computer?                 -> push desktop now, defer mobile
 *   6. Quiet hours                           -> handled by the engine
 */

import prisma from '@/lib/prisma'
import { dispatchNotification, type PushJobPlan } from '@/lib/notification-engine'
import {
  getPresenceSnapshot,
  isActiveOnDesktop,
  isOnline,
  isViewing,
  MOBILE_PUSH_DELAY_MS,
} from '@/lib/presence'
import {
  BROADCAST_SCOPES,
  buildPreview,
  buildTitle,
  matchesKeyword,
  type MentionScope,
} from '@/lib/chat-mentions'

// Re-exported so callers have a single import for chat notification concerns.
export { parseMentionScope, toPlainText, parseMentionedIds } from '@/lib/chat-mentions'
export type { MentionScope } from '@/lib/chat-mentions'

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotifyLevel = 'ALL' | 'MENTIONS' | 'NONE'

interface DispatchArgs {
  conversationId: string
  messageId: string
  senderId: string
  senderName: string
  /** Plain-text form of the message, used for previews and keyword matching. */
  text: string
  mentionedUserIds: string[]
  mentionScope: MentionScope
  /** Falls back to the conversation's own org when the session doesn't carry one. */
  orgId?: string
  /**
   * Narrows the audience to these users plus anyone mentioned. Used for thread
   * replies, which reach the thread's followers rather than the whole channel.
   * Omit to address every participant.
   */
  restrictToUserIds?: string[]
  /** Shown in the notification title so a thread reply reads as one. */
  isThreadReply?: boolean
}

// ─── Burst debounce ─────────────────────────────────────────────────────────

/**
 * Someone typing five messages in a row should buzz a phone once, not five
 * times. Suppresses repeat *pushes* for the same conversation inside a short
 * window; the in-app record is always written, so nothing disappears from the
 * notification list or the unread count.
 *
 * Deliberately in-process and unbounded-in-time only by the sweep below: this
 * is a comfort heuristic, and losing it on restart costs nothing. Mentions
 * always bypass it.
 */
const PUSH_DEBOUNCE_MS = 60 * 1000
const lastPushedAt = new Map<string, number>()

function shouldDebouncePush(userId: string, conversationId: string): boolean {
  const key = `${userId}:${conversationId}`
  const now = Date.now()
  const previous = lastPushedAt.get(key)

  if (previous !== undefined && now - previous < PUSH_DEBOUNCE_MS) return true

  lastPushedAt.set(key, now)

  // Opportunistic sweep so a long-lived process cannot grow this without bound.
  if (lastPushedAt.size > 5000) {
    for (const [k, t] of lastPushedAt) {
      if (now - t >= PUSH_DEBOUNCE_MS) lastPushedAt.delete(k)
    }
  }
  return false
}

// ─── Main entry point ───────────────────────────────────────────────────────

/**
 * Fans a new chat message out to its conversation's participants. Safe to await
 * from a server action: every failure is contained so a notification problem
 * can never fail the send itself.
 */
export async function notifyChatMessage(args: DispatchArgs): Promise<void> {
  try {
    const conversation = await prisma.chatConversation.findUnique({
      where:  { id: args.conversationId },
      select: {
        id: true,
        is_group: true,
        name: true,
        orgId: true,
        participants: {
          select: {
            user_id: true,
            notify_level: true,
            muted_until: true,
          },
        },
      },
    })

    if (!conversation) return

    // `@everyone` only means everyone in the General channel, the one place
    // membership is the whole org. Elsewhere it degrades to the channel.
    const isGeneralChannel = conversation.is_group && conversation.name === 'General'
    const effectiveScope: MentionScope =
      args.mentionScope === 'EVERYONE' && !isGeneralChannel ? 'CHANNEL' : args.mentionScope

    let recipients = conversation.participants.filter(p => p.user_id !== args.senderId) // gate 1

    // Thread replies reach the thread's followers, not the whole channel —
    // except for people explicitly mentioned, who are always addressed.
    if (args.restrictToUserIds) {
      const audience = new Set([...args.restrictToUserIds, ...args.mentionedUserIds])
      recipients = recipients.filter(p => audience.has(p.user_id))
    }

    if (recipients.length === 0) return

    // Gates 4 and 5 in one Redis round trip, so cost does not scale with the
    // number of participants.
    const presence = await getPresenceSnapshot(args.conversationId)

    // Only load preferences for people who might need a keyword test.
    const prefs = await prisma.notificationPreference.findMany({
      where:  { userId: { in: recipients.map(r => r.user_id) } },
      select: { userId: true, keywords: true },
    })
    const keywordsByUser = new Map(prefs.map(p => [p.userId, p.keywords ?? []]))

    const preview = buildPreview(args.text, false)
    const now = new Date()

    for (const participant of recipients) {
      const level = (participant.notify_level as NotifyLevel) ?? 'MENTIONS'
      const mutedUntil = participant.muted_until

      // ── Gate 2: muted, either permanently or on a timer ──────────────────
      const isMuted = level === 'NONE' || (mutedUntil !== null && mutedUntil > now)
      if (isMuted) continue

      // ── Gate 3: is this worth interrupting for? ──────────────────────────
      const isNamed = args.mentionedUserIds.includes(participant.user_id)
      const isBroadcast =
        BROADCAST_SCOPES.includes(effectiveScope) &&
        // `@here` reaches only the people already online.
        (effectiveScope !== 'HERE' || isOnline(presence, participant.user_id))
      const isKeyword = matchesKeyword(args.text, keywordsByUser.get(participant.user_id) ?? [])
      const isMention = isNamed || isBroadcast || isKeyword
      const isDirect = !conversation.is_group

      if (!isDirect && !isMention && level !== 'ALL') continue

      // ── Gate 4: already looking at it ────────────────────────────────────
      // The socket broadcast has already updated their open view, so a push
      // would only duplicate what is on screen. The DB row is still written so
      // the notification history stays complete.
      const viewingNow = isViewing(presence, participant.user_id)

      // ── Gate 5: hold mobile back while they are at a computer ────────────
      let pushPlan: PushJobPlan[] | undefined
      if (viewingNow) {
        pushPlan = []
      } else if (!isMention && shouldDebouncePush(participant.user_id, args.conversationId)) {
        // Mid-burst: record it in-app, but leave their devices alone.
        pushPlan = []
      } else if (isActiveOnDesktop(presence, participant.user_id)) {
        pushPlan = [
          { deviceClass: 'desktop' },
          {
            deviceClass: 'mobile',
            delayMs: MOBILE_PUSH_DELAY_MS,
            cancelIfRead: {
              conversationId: args.conversationId,
              messageId: args.messageId,
            },
          },
        ]
      }

      // Gate 6 (quiet hours) is applied by the engine's channel resolution.
      await dispatchNotification({
        userId:     participant.user_id,
        orgId:      args.orgId || conversation.orgId,
        type:       isMention ? 'chat_mention' : 'chat_message',
        title:      buildTitle(args.senderName, conversation, isMention, effectiveScope, args.isThreadReply),
        body:       preview,
        link:       '/chat',
        entityType: 'chat_message',
        entityId:   args.messageId,
        priority:   isMention ? 'HIGH' : 'MEDIUM',
        pushPlan,
        // One notification slot per conversation, so a chat that gets three
        // messages replaces its own banner instead of stacking three.
        pushTag:    conversationTag(args.conversationId),
      })
    }
  } catch (err) {
    console.error('[ChatNotifications] notifyChatMessage failed:', err)
  }
}

/** Notification group for a conversation, shared by delivery and dismissal. */
export function conversationTag(conversationId: string): string {
  return `agencyos-chat-${conversationId}`
}

/**
 * Clears this conversation's notification from the user's *other* devices.
 *
 * Called when a conversation is read. Sends a silent control push that the
 * service worker turns into a `notification.close()`, which is what makes
 * reading on a laptop clear the phone's lock screen. Best-effort by nature: if
 * a device is offline the stale banner simply remains until tapped.
 */
export async function dismissConversationNotifications(
  userId: string,
  conversationId: string,
): Promise<void> {
  try {
    const { sendWebPushToUser, isWebPushConfigured } = await import('@/lib/web-push')
    if (!isWebPushConfigured()) return

    await sendWebPushToUser(userId, {
      title:    '',
      body:     '',
      action:   'dismiss',
      tag:      conversationTag(conversationId),
      entityId: conversationId,
    })
  } catch (err) {
    console.warn('[ChatNotifications] dismiss failed:', err)
  }
}

/**
 * Who follows a thread: whoever started it, plus everyone who has replied to it.
 * Derived from existing reply links rather than a subscription table — the same
 * implicit rule Slack uses.
 */
export async function getThreadFollowers(parentMessageId: string): Promise<string[]> {
  const [parent, replies] = await Promise.all([
    prisma.chatMessage.findUnique({
      where:  { id: parentMessageId },
      select: { sender_id: true },
    }),
    prisma.chatMessage.findMany({
      where:  { reply_to_id: parentMessageId },
      select: { sender_id: true },
      distinct: ['sender_id'],
    }),
  ])

  const followers = new Set<string>()
  if (parent) followers.add(parent.sender_id)
  for (const reply of replies) followers.add(reply.sender_id)
  return [...followers]
}
