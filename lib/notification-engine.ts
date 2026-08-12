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
}

// ─── Default Delivery Rules ──────────────────────────────────────────────────

const DELIVERY_RULES: Record<NotificationEventType, DeliveryChannel[]> = {
  task_assigned:     ['in_app', 'push', 'email'],
  task_status:       ['in_app', 'push'],
  task_overdue:      ['in_app', 'push', 'email'],
  task_due_soon:     ['in_app', 'push'],
  mention:           ['in_app', 'push'],
  comment:           ['in_app', 'push'],
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

function isQuietHours(start: number | null | undefined, end: number | null | undefined): boolean {
  if (start == null || end == null) return false
  const now = new Date()
  const currentHour = now.getHours()
  if (start <= end) {
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
  if (isQuietHours(prefs.quietHoursStart, prefs.quietHoursEnd)) {
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
          await queue.add('send-push', {
            userId:    event.userId,
            title:     event.title,
            body:      event.body,
            link:      event.link,
            priority:  event.priority ?? 'MEDIUM',
          }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })
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
      await sendWebPushToUser(event.userId, {
        title: event.title,
        body: event.body,
        link: event.link || undefined,
        type: event.type,
      })
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
