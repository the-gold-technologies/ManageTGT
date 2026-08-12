/**
 * lib/notification-engine.ts
 *
 * Central Notification Engine — provider-agnostic.
 * All notification dispatch goes through here.
 * Never import FCM/email libraries directly in business logic; use this.
 */

import prisma from '@/lib/prisma'

// ─── Types ──────────────────────────────────────────────────────────────────

export type NotificationEventType =
  | 'task_assigned'
  | 'task_status'
  | 'task_overdue'
  | 'task_due_soon'
  | 'mention'
  | 'comment'
  | 'chat_message'
  | 'chat_mention'
  | 'project_assigned'
  | 'project_update'
  | 'approval_required'
  | 'approval_granted'
  | 'invoice_update'
  | 'payment_received'
  | 'file_uploaded'
  | 'team_update'
  | 'system_alert'
  | 'reminder'

export type DeliveryChannel = 'in_app' | 'push' | 'email'
export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export type DeviceClass = 'desktop' | 'mobile'

/**
 * One scheduled push send. A single notification can carry several of these so
 * that, for example, desktop is pushed immediately while mobile is deferred and
 * dropped if the message gets read in the meantime.
 */
export interface PushJobPlan {
  /** Restrict this send to one class of device. Omit to reach every device. */
  deviceClass?: DeviceClass
  /** Defer the send. Used for the "hold mobile while active on desktop" rule. */
  delayMs?: number
  /** Skip the send if the recipient has already read past this message. */
  cancelIfRead?: { conversationId: string; messageId: string }
}

export interface NotificationEvent {
  userId: string
  orgId: string
  type: NotificationEventType
  title: string
  body: string
  link?: string
  entityType?: string
  entityId?: string
  priority?: NotificationPriority
  /**
   * Overrides the default "one push to every device" behaviour. Ignored unless
   * the resolved channels include push.
   */
  pushPlan?: PushJobPlan[]
  /**
   * Groups this notification on the device so a newer one replaces the older it
   * supersedes, and gives read-elsewhere dismissal something to target.
   */
  pushTag?: string
}

// ─── Default Delivery Rules ──────────────────────────────────────────────────

const DELIVERY_RULES: Record<NotificationEventType, DeliveryChannel[]> = {
  task_assigned:     ['in_app', 'push', 'email'],
  task_status:       ['in_app', 'push'],
  task_overdue:      ['in_app', 'push', 'email'],
  task_due_soon:     ['in_app', 'push'],
  mention:           ['in_app', 'push'],
  comment:           ['in_app', 'push'],
  // Chat deliberately never emails. Per-message chat email is universally
  // regretted; missed mentions belong in a digest instead.
  chat_message:      ['in_app', 'push'],
  chat_mention:      ['in_app', 'push'],
  project_assigned:  ['in_app', 'push', 'email'],
  project_update:    ['in_app'],
  approval_required: ['in_app', 'push', 'email'],
  approval_granted:  ['in_app', 'push'],
  invoice_update:    ['in_app', 'push', 'email'],
  payment_received:  ['in_app', 'push'],
  file_uploaded:     ['in_app'],
  team_update:       ['in_app'],
  system_alert:      ['in_app', 'push', 'email'],
  reminder:          ['in_app', 'push'],
}

// ─── Quiet Hours Check ───────────────────────────────────────────────────────

/**
 * Current hour (0-23) in the given IANA timezone. Falls back to the server's
 * clock only when no zone is stored or the stored one is unusable.
 */
function hourInZone(timezone: string | null | undefined): number {
  if (!timezone) return new Date().getHours()
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour:     'numeric',
      hour12:   false,
    }).format(new Date())
    // "24" appears in some locales for midnight; normalise it to 0.
    const hour = parseInt(formatted, 10) % 24
    return Number.isNaN(hour) ? new Date().getHours() : hour
  } catch {
    // Invalid timezone name — better to notify than to silence indefinitely.
    console.warn(`[NotificationEngine] Unknown timezone "${timezone}", using server time`)
    return new Date().getHours()
  }
}

function isQuietHours(
  start: number | null | undefined,
  end: number | null | undefined,
  timezone: string | null | undefined,
): boolean {
  if (start == null || end == null) return false
  const currentHour = hourInZone(timezone)
  if (start === end) return false // a zero-length window silences nothing
  if (start < end) {
    return currentHour >= start && currentHour < end
  }
  // Spans midnight (e.g. 22:00 → 08:00)
  return currentHour >= start || currentHour < end
}

// ─── Resolve Channels ────────────────────────────────────────────────────────

async function resolveChannels(
  userId: string,
  type: NotificationEventType,
): Promise<DeliveryChannel[]> {
  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  })

  // Start with default rules for this event type
  let channels: DeliveryChannel[] = [...DELIVERY_RULES[type]]

  if (!prefs) return channels

  // Apply per-event overrides if set
  const overrides = prefs.channelOverrides as Record<string, DeliveryChannel[]>
  if (overrides[type]) {
    channels = overrides[type]
  }

  // Apply global channel toggles
  if (!prefs.inAppEnabled) channels = channels.filter(c => c !== 'in_app')
  if (!prefs.pushEnabled)  channels = channels.filter(c => c !== 'push')
  if (!prefs.emailEnabled) channels = channels.filter(c => c !== 'email')

  // Apply quiet hours for push and email
  if (prefs.quietHoursEnabled && isQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd, prefs.timezone)) {
    channels = channels.filter(c => c !== 'push' && c !== 'email')
  }

  return channels
}

// ─── Main Dispatch Function ───────────────────────────────────────────────────

export async function dispatchNotification(event: NotificationEvent): Promise<void> {
  try {
    // 1. Resolve which channels to use
    const channels = await resolveChannels(event.userId, event.type)

    // 2. Write notification to DB (always — in_app channel is the DB record)
    const notification = await prisma.notification.create({
      data: {
        user_id:    event.userId,
        orgId:      event.orgId,
        type:       event.type,
        title:      event.title,
        message:    event.body,
        link:       event.link,
        priority:   event.priority ?? 'MEDIUM',
        entityType: event.entityType,
        entityId:   event.entityId,
        channels,
      },
    })

    // 3. Real-time in-app delivery via Socket.IO
    if (channels.includes('in_app')) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const globalIo = (global as any).__socketIo
        if (globalIo) {
          globalIo.to(`notif:${event.userId}`).emit('notification:new', {
            id:         notification.id,
            type:       notification.type,
            title:      notification.title,
            message:    notification.message,
            link:       notification.link,
            priority:   notification.priority,
            entityType: notification.entityType,
            entityId:   notification.entityId,
            createdAt:  notification.createdAt,
            is_read:    false,
          })
        }
      } catch (socketErr) {
        console.warn('[NotificationEngine] Socket.IO emit failed:', socketErr)
      }
    }

    // 4. Enqueue async jobs for push and email (non-blocking)
    if (channels.includes('push') || channels.includes('email')) {
      try {
        const { getNotificationQueue } = await import('./notification-queue')
        const queue = getNotificationQueue()

        if (channels.includes('push')) {
          // One job per plan entry, or a single unrestricted job by default.
          const plans: PushJobPlan[] = event.pushPlan?.length ? event.pushPlan : [{}]

          for (const plan of plans) {
            await queue.add('send-push', {
              userId:       event.userId,
              title:        event.title,
              body:         event.body,
              link:         event.link,
              type:         event.type,
              tag:          event.pushTag,
              entityId:     event.entityId,
              priority:     event.priority ?? 'MEDIUM',
              deviceClass:  plan.deviceClass,
              cancelIfRead: plan.cancelIfRead,
            }, {
              attempts: 3,
              backoff:  { type: 'exponential', delay: 2000 },
              ...(plan.delayMs ? { delay: plan.delayMs } : {}),
            })
          }
        }

        if (channels.includes('email')) {
          await queue.add('send-email', {
            userId:    event.userId,
            type:      event.type,
            title:     event.title,
            body:      event.body,
            link:      event.link,
          }, { attempts: 3, backoff: { type: 'exponential', delay: 5000 } })
        }
      } catch (queueErr) {
        console.warn('[NotificationEngine] BullMQ enqueue failed (Redis may not be configured):', queueErr)
        // Fallback: attempt direct push/email if queue unavailable
        await fallbackDeliver(event, channels)
      }
    }

  } catch (err) {
    console.error('[NotificationEngine] dispatchNotification error:', err)
  }
}

// ─── Fallback Direct Delivery ─────────────────────────────────────────────────
// Used when Redis/BullMQ is not configured

async function fallbackDeliver(event: NotificationEvent, channels: DeliveryChannel[]) {
  // Resolve user email for email delivery
  const user = await prisma.user.findUnique({
    where: { id: event.userId },
    select: { email: true, name: true },
  })

  if (channels.includes('push')) {
    try {
      const { sendWebPushToUser } = await import('./web-push')
      // Without a queue there is nothing to defer with, so deferred sends are
      // dropped rather than fired early — firing them now would defeat the
      // whole point of holding mobile back.
      const plans = event.pushPlan?.length
        ? event.pushPlan.filter(p => !p.delayMs)
        : [{} as PushJobPlan]

      for (const plan of plans) {
        await sendWebPushToUser(event.userId, {
          title:    event.title,
          body:     event.body,
          link:     event.link || undefined,
          type:     event.type,
          tag:      event.pushTag,
          entityId: event.entityId,
        }, { deviceClass: plan.deviceClass })
      }
    } catch (e) {
      console.warn('[NotificationEngine] Direct web-push fallback failed:', e)
    }
  }

  if (channels.includes('email') && user?.email) {
    try {
      const { sendNotificationEmail } = await import('./email')
      await sendNotificationEmail({
        toEmail:       user.email,
        recipientName: user.name || 'Team Member',
        notification: {
          title: event.title,
          body:  event.body,
          link:  event.link,
          type:  event.type,
        },
      })
    } catch (e) {
      console.warn('[NotificationEngine] Direct email fallback failed:', e)
    }
  }
}
