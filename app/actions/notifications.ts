'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function cleanupOldNotifications(userId: string) {
  try {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    await prisma.notification.deleteMany({
      where: {
        user_id: userId,
        is_read: true,
        createdAt: {
          lt: thirtyDaysAgo
        }
      }
    })
  } catch (error) {
    console.error('Error cleaning up old notifications:', error)
  }
}

export async function getNotifications() {
  try {
    const session = await auth()
    if (!session?.user?.id) return []

    // Opportunistically cleanup old notifications for this user
    await cleanupOldNotifications(session.user.id)

    const notifications = await prisma.notification.findMany({
      where: { user_id: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to recent 50
    })
    return notifications
  } catch (error) {
    console.error('Error fetching notifications:', error)
    return []
  }
}

export async function markAsRead(id: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    await prisma.notification.update({
      where: { id, user_id: session.user.id },
      data: { is_read: true }
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
      data: { is_read: true }
    })
    return { success: true }
  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    return { success: false, error: 'Failed to mark all as read' }
  }
}

export async function createNotification(data: {
  user_id: string
  type: string
  title: string
  message: string
  link?: string
}) {
  try {
    await prisma.notification.create({
      data: {
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        link: data.link
      }
    })
    return { success: true }
  } catch (error) {
    console.error('Error creating notification:', error)
    return { success: false, error: 'Failed to create notification' }
  }
}
