'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

// ─── Cleanup ──────────────────────────────────────────────────────────────────

export async function cleanupOldNotifications(userId: string) {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    await prisma.notification.deleteMany({
      where: {
        user_id:  userId,
        is_read:  true,
        createdAt: { lt: thirtyDaysAgo },
      },
    })
  } catch (error) {
    console.error('Error cleaning up old notifications:', error)
  }
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

export async function getNotifications() {
  try {
    const session = await auth()
    if (!session?.user?.id) return []

    await cleanupOldNotifications(session.user.id)

    const notifications = await prisma.notification.findMany({
      where: { user_id: session.user.id },
      orderBy: [
        { is_read: 'asc' },
        { createdAt: 'desc' },
      ],
      take: 60,
    })
    return notifications
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return []
  }
}

export async function getUnreadCount() {
  try {
    const session = await auth()
    if (!session?.user?.id) return 0
    return await prisma.notification.count({
      where: { user_id: session.user.id, is_read: false },
    })
  } catch {
    return 0
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function markAsRead(id: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    await prisma.notification.update({
      where: { id, user_id: session.user.id },
      data:  { is_read: true, readAt: new Date() },
    })
    return { success: true }
  } catch (error) {
    console.error('Error marking notification as read:', error)
    return { success: false, error: 'Failed to mark as read' }
  }
}

export async function markAllAsRead() {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    await prisma.notification.updateMany({
      where: { user_id: session.user.id, is_read: false },
      data:  { is_read: true, readAt: new Date() },
    })
    return { success: true }
  } catch (error) {
    console.error('Error marking all as read:', error)
    return { success: false, error: 'Failed to mark all as read' }
  }
}

export async function deleteNotification(id: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    await prisma.notification.delete({
      where: { id, user_id: session.user.id },
    })
    return { success: true }
  } catch (error) {
    console.error('Error deleting notification:', error)
    return { success: false, error: 'Failed to delete' }
  }
}

export async function deleteAllReadNotifications() {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    await prisma.notification.deleteMany({
      where: { user_id: session.user.id, is_read: true },
    })
    return { success: true }
  } catch (error) {
    console.error('Error deleting read notifications:', error)
    return { success: false, error: 'Failed to clear' }
  }
}

// ─── Legacy compat ────────────────────────────────────────────────────────────
// Keep for backward compatibility with any direct callers

export async function createNotification(data: {
  user_id: string
  type: string
  title: string
  message: string
  link?: string
  orgId?: string
}) {
  try {
    await prisma.notification.create({
      data: {
        user_id: data.user_id,
        orgId:   data.orgId || 'default_org_id',
        type:    data.type,
        title:   data.title,
        message: data.message,
        link:    data.link,
      },
    })
    return { success: true }
  } catch (error) {
    console.error('Error creating notification:', error)
    return { success: false, error: 'Failed to create notification' }
  }
}

// ─── Notification Preferences ─────────────────────────────────────────────────

export async function getNotificationPreferences() {
  try {
    const session = await auth()
    if (!session?.user?.id) return null

    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
    })
    return prefs
  } catch (error) {
    console.error('Error fetching notification preferences:', error)
    return null
  }
}

export async function updateNotificationPreferences(data: {
  inAppEnabled?: boolean
  pushEnabled?: boolean
  emailEnabled?: boolean
  channelOverrides?: Record<string, string[]>
  quietHoursEnabled?: boolean
  quietHoursStart?: number | null
  quietHoursEnd?: number | null
}) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { orgId: true },
    })

    await prisma.notificationPreference.upsert({
      where:  { userId: session.user.id },
      create: {
        userId: session.user.id,
        orgId:  dbUser?.orgId || 'default_org_id',
        ...data,
      },
      update: data,
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Error updating notification preferences:', error)
    return { success: false, error: 'Failed to update preferences' }
  }
}

// ─── Push Subscriptions ───────────────────────────────────────────────────────

export async function getPushSubscriptions() {
  try {
    const session = await auth()
    if (!session?.user?.id) return []

    return await prisma.pushSubscription.findMany({
      where:   { userId: session.user.id, isActive: true },
      orderBy: { lastSeenAt: 'desc' },
    })
  } catch (error) {
    console.error('Error fetching push subscriptions:', error)
    return []
  }
}

export async function removePushSubscription(id: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    await prisma.pushSubscription.updateMany({
      where: { id, userId: session.user.id },
      data:  { isActive: false },
    })
    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Error removing push subscription:', error)
    return { success: false, error: 'Failed to remove' }
  }
}

/**
 * Records the browser's IANA timezone so quiet hours are evaluated in the
 * user's own day rather than the server's. Called on app load, so it needs to
 * be cheap and silent: it writes only when the value actually changed.
 */
export async function syncUserTimezone(timezone: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false }

    // Reject anything the runtime cannot resolve, rather than storing junk that
    // would silently fall back to server time on every notification.
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    } catch {
      return { success: false, error: 'Invalid timezone' }
    }

    const existing = await prisma.notificationPreference.findUnique({
      where:  { userId: session.user.id },
      select: { timezone: true },
    })

    if (existing?.timezone === timezone) return { success: true, unchanged: true }

    const dbUser = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { orgId: true },
    })

    await prisma.notificationPreference.upsert({
      where:  { userId: session.user.id },
      create: {
        userId: session.user.id,
        orgId:  dbUser?.orgId || 'default_org_id',
        timezone,
      },
      update: { timezone },
    })

    return { success: true }
  } catch (error) {
    console.error('Error syncing timezone:', error)
    return { success: false }
  }
}

export async function sendTestNotification() {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const { dispatchNotification } = await import('@/lib/notification-engine')
    
    await dispatchNotification({
      userId: session.user.id,
      orgId: 'default_org_id',
      type: 'system_alert',
      title: 'It Works! 🎉',
      body: 'Your notification system is fully operational.',
      link: '/settings',
    })

    // Report why push may not arrive — push failures are otherwise silent.
    const { isWebPushConfigured } = await import('@/lib/web-push')
    const activeDevices = await prisma.pushSubscription.count({
      where: { userId: session.user.id, isActive: true },
    })

    return {
      success: true,
      push: {
        configured: isWebPushConfigured(),
        activeDevices,
      },
    }
  } catch (error) {
    console.error('Error sending test notification:', error)
    return { success: false, error: 'Failed to send test notification' }
  }
}
