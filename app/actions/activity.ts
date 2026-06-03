'use server'

import prisma from '@/lib/prisma'

export async function getActivities() {
  try {
    const logs = await prisma.activityLog.findMany({
      include: {
        performer: { select: { id: true, name: true, image: true } },
        task: { select: { id: true, title: true } },
        project: { select: { id: true, name: true } }
      },
      orderBy: { performed_at: 'desc' },
      take: 50
    })

    return logs.map(log => ({
      id: log.id,
      action: log.action,
      performed_at: log.performed_at.toISOString(),
      metadata: log.metadata,
      performed_by: log.performer ? { full_name: log.performer.name || 'System', avatar_url: log.performer.image } : null,
      task: log.task ? { title: log.task.title } : null,
      project: log.project ? { name: log.project.name } : null
    }))
  } catch (error) {
    console.error('Error fetching activities:', error)
    return []
  }
}
