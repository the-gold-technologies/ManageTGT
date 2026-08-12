/**
 * lib/notification-queue.ts
 *
 * BullMQ queue + workers for async notification delivery.
 * Runs inside server.js on startup.
 */

import { Queue, Worker, type Job } from 'bullmq'
import IORedis from 'ioredis'
import prisma from '@/lib/prisma'

// ─── Redis Connection ─────────────────────────────────────────────────────────

let redisConnection: IORedis | null = null

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
    })
    redisConnection.on('error', (err) => {
      console.warn('[NotificationQueue] Redis connection error:', err.message)
    })
  }
  return redisConnection
}

// ─── Queue ────────────────────────────────────────────────────────────────────

let notificationQueue: Queue | null = null

export function getNotificationQueue(): Queue {
  if (!notificationQueue) {
    notificationQueue = new Queue('notifications', {
      connection: getRedisConnection(),
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    })
  }
  return notificationQueue
}

// ─── Workers ─────────────────────────────────────────────────────────────────

export function startNotificationWorkers() {
  const connection = getRedisConnection()

  // Push Worker
  const pushWorker = new Worker(
    'notifications',
    async (job: Job) => {
      if (job.name === 'send-push') {
        await handlePushJob(job.data)
      } else if (job.name === 'send-email') {
        await handleEmailJob(job.data)
      } else if (job.name === 'scan-overdue-tasks') {
        await scanOverdueTasks()
      } else if (job.name === 'scan-due-soon-tasks') {
        await scanDueSoonTasks()
      } else if (job.name === 'scan-overdue-invoices') {
        await scanOverdueInvoices()
      }
    },
    {
      connection,
      concurrency: 5,
    }
  )

  pushWorker.on('completed', (job) => {
    console.log(`[NotificationQueue] Job ${job.id} (${job.name}) completed`)
  })

  pushWorker.on('failed', (job, err) => {
    console.error(`[NotificationQueue] Job ${job?.id} (${job?.name}) failed:`, err.message)
  })

  // Schedule repeatable jobs
  scheduleRepeatableJobs()

  console.log('[NotificationQueue] Workers started')
  return pushWorker
}

// ─── Scheduled Job Setup ──────────────────────────────────────────────────────

async function scheduleRepeatableJobs() {
  try {
    const queue = getNotificationQueue()

    // BullMQ v6 removed `repeat` from Queue.add — repeating work must go through
    // upsertJobScheduler, otherwise the job runs once and never again.
    // The scheduler id doubles as the dedupe key, so restarts don't stack jobs.
    const schedules: Array<{ id: string; pattern: string }> = [
      { id: 'scan-overdue-tasks',    pattern: '0 * * * *' },  // hourly at :00
      { id: 'scan-due-soon-tasks',   pattern: '30 * * * *' }, // hourly at :30
      { id: 'scan-overdue-invoices', pattern: '0 9 * * *' },  // daily at 09:00
    ]

    for (const { id, pattern } of schedules) {
      await queue.upsertJobScheduler(id, { pattern }, { name: id, data: {} })
    }

    console.log(`[NotificationQueue] ${schedules.length} repeatable jobs scheduled`)
  } catch (err) {
    console.warn('[NotificationQueue] Failed to schedule repeatable jobs:', err)
  }
}

// ─── Job Handlers ─────────────────────────────────────────────────────────────

async function handlePushJob(data: {
  userId: string
  title: string
  body: string
  link?: string
  priority: string
}) {
  try {
    const { sendWebPushToUser } = await import('./web-push')
    await sendWebPushToUser(data.userId, {
      title: data.title,
      body:  data.body,
      link:  data.link,
    })
  } catch (err) {
    console.error('[NotificationQueue] Push job failed:', err)
    throw err // Re-throw to trigger BullMQ retry
  }
}

async function handleEmailJob(data: {
  userId: string
  type: string
  title: string
  body: string
  link?: string
}) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { email: true, name: true },
    })

    if (!user?.email) return

    const { sendNotificationEmail } = await import('./email')
    await sendNotificationEmail({
      toEmail:       user.email,
      recipientName: user.name || 'Team Member',
      notification: {
        title: data.title,
        body:  data.body,
        link:  data.link,
        type:  data.type,
      },
    })
  } catch (err) {
    console.error('[NotificationQueue] Email job failed:', err)
    throw err
  }
}

// ─── Scheduled Scan Handlers ──────────────────────────────────────────────────

async function scanOverdueTasks() {
  const { dispatchNotification } = await import('./notification-engine')
  const now = new Date()

  const tasks = await prisma.task.findMany({
    where: {
      deadline: { lt: now },
      status:   { notIn: ['completed'] },
    },
    select: {
      id: true,
      title: true,
      deadline: true,
      assigned_member_ids: true,
      orgId: true,
    },
    take: 100, // batch limit
  })

  for (const task of tasks) {
    for (const userId of task.assigned_member_ids) {
      // Avoid spamming — check if overdue notification was already sent today
      const alreadySent = await prisma.notification.findFirst({
        where: {
          user_id:    userId,
          type:       'task_overdue',
          entityId:   task.id,
          createdAt:  { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
        },
      })
      if (alreadySent) continue

      await dispatchNotification({
        userId,
        orgId:      task.orgId,
        type:       'task_overdue',
        title:      'Task Overdue',
        body:       `"${task.title}" was due ${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'recently'} and is not yet complete.`,
        link:       '/my-tasks',
        entityType: 'task',
        entityId:   task.id,
        priority:   'HIGH',
      })
    }
  }
}

async function scanDueSoonTasks() {
  const { dispatchNotification } = await import('./notification-engine')
  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const tasks = await prisma.task.findMany({
    where: {
      deadline: { gte: now, lte: in24h },
      status:   { notIn: ['completed'] },
    },
    select: {
      id: true,
      title: true,
      deadline: true,
      assigned_member_ids: true,
      orgId: true,
    },
    take: 100,
  })

  for (const task of tasks) {
    for (const userId of task.assigned_member_ids) {
      const alreadySent = await prisma.notification.findFirst({
        where: {
          user_id:   userId,
          type:      'task_due_soon',
          entityId:  task.id,
          createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
        },
      })
      if (alreadySent) continue

      await dispatchNotification({
        userId,
        orgId:      task.orgId,
        type:       'task_due_soon',
        title:      'Task Due Soon',
        body:       `"${task.title}" is due ${task.deadline ? new Date(task.deadline).toLocaleString() : 'soon'}.`,
        link:       '/my-tasks',
        entityType: 'task',
        entityId:   task.id,
        priority:   'MEDIUM',
      })
    }
  }
}

async function scanOverdueInvoices() {
  const { dispatchNotification } = await import('./notification-engine')
  const now = new Date()

  const invoices = await prisma.invoice.findMany({
    where: {
      due_date: { lt: now },
      status:   { in: ['pending', 'partially_paid'] },
    },
    select: {
      id: true,
      invoice_number: true,
      due_date: true,
      created_by: true,
      orgId: true,
    },
    take: 50,
  })

  for (const invoice of invoices) {
    if (!invoice.created_by) continue

    const alreadySent = await prisma.notification.findFirst({
      where: {
        user_id:   invoice.created_by,
        type:      'invoice_update',
        entityId:  invoice.id,
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      },
    })
    if (alreadySent) continue

    await dispatchNotification({
      userId:     invoice.created_by,
      orgId:      invoice.orgId,
      type:       'invoice_update',
      title:      'Invoice Overdue',
      body:       `Invoice ${invoice.invoice_number} is overdue. Due date was ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'past'}.`,
      link:       '/finance/revenue',
      entityType: 'invoice',
      entityId:   invoice.id,
      priority:   'HIGH',
    })
  }
}
