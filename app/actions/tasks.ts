'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { createNotification } from './notifications'

export async function getTasks() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        assigner: {
          select: { id: true, name: true }
        },
        project: {
          select: { id: true, name: true, project_code: true }
        },
        files: true,
        subtasks: {
          orderBy: { createdAt: 'asc' }
        },
        logs: {
          include: {
            performer: { select: { id: true, name: true } }
          },
          orderBy: { performed_at: 'asc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    })
    return tasks.map(t => ({
      ...t,
      assignee: null,
      assigner: t.assigner ? { id: t.assigner.id, full_name: t.assigner.name } : null
    }))
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
}

export async function updateTaskStatus(id: string, status: any, completion_date?: string) {
  try {
    const session = await auth()
    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: { 
          status, 
          ...(completion_date ? { completion_date: new Date(completion_date) } : {})
        }
      })
      
      await tx.activityLog.create({
        data: {
          task_id: task.id,
          project_id: task.project_id,
          action: `Task status changed to ${status}`,
          performed_by: session?.user?.id || null,
        }
      })
      
      return task
    })

    // Notify assignee if someone else changed the status
    if (result.assigned_member_ids?.length > 0) {
      for (const assigneeId of result.assigned_member_ids) {
        if (assigneeId !== session?.user?.id) {
          await createNotification({
            user_id: assigneeId,
            type: 'task_status',
            title: 'Task Status Updated',
            message: `Status changed to ${status} for task: ${result.title}`,
            link: '/my-tasks'
          })
        }
      }
    }
    // Notify assigner if someone else changed the status
    if (result.assigned_by && result.assigned_by !== session?.user?.id) {
      await createNotification({
        user_id: result.assigned_by,
        type: 'task_status',
        title: 'Task Status Updated',
        message: `Status changed to ${status} for task: ${result.title}`,
        link: '/my-tasks'
      })
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Error updating task status:', error)
    return { success: false, error: 'Failed to update task' }
  }
}

export async function deleteTask(id: string) {
  try {
    const task = await prisma.task.delete({
      where: { id }
    })
    
    revalidatePath('/my-tasks')
    return { success: true }
  } catch (error) {
    console.error('Error deleting task:', error)
    return { success: false, error: 'Failed to delete task' }
  }
}

import { auth } from '@/auth'

export async function createTask(data: any) {
  try {
    const session = await auth()
    const { project_id, assigned_member_ids, assigned_by, ...restData } = data
    const assignerId = session?.user?.id || assigned_by

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          ...restData,
          ...(project_id ? { project: { connect: { id: project_id } } } : {}),
          ...(assigned_member_ids && assigned_member_ids.length > 0 ? { assigned_member_ids } : {}),
          ...(assignerId ? { assigner: { connect: { id: assignerId } } } : {})
        }
      })

      await tx.activityLog.create({
        data: {
          task_id: task.id,
          project_id: task.project_id,
          action: 'Task created',
          performed_by: session?.user?.id || null,
        }
      })

      return task
    })
    
    // Notify the assignee
    if (result.assigned_member_ids?.length > 0) {
      for (const assigneeId of result.assigned_member_ids) {
        if (assigneeId !== session?.user?.id) {
          await createNotification({
            user_id: assigneeId,
            type: 'task_assigned',
            title: 'New Task Assigned',
            message: `You have been assigned to task: ${result.title}`,
            link: '/my-tasks'
          })
        }
      }
    }

    revalidatePath('/', 'layout')
    return { success: true, task: result }
  } catch (error) {
    console.error('Error creating task:', error)
    return { success: false, error: 'Failed to create task' }
  }
}

export async function updateTask(id: string, data: any) {
  try {
    const session = await auth()
    const { project_id, assigned_member_ids, assigned_by, ...restData } = data

    const result = await prisma.$transaction(async (tx) => {
      const task = await tx.task.update({
        where: { id },
        data: {
          ...restData,
          ...(project_id !== undefined ? { project: project_id ? { connect: { id: project_id } } : { disconnect: true } } : {}),
          ...(assigned_member_ids !== undefined ? { assigned_member_ids } : {}),
          ...(assigned_by !== undefined ? { assigner: assigned_by ? { connect: { id: assigned_by } } : { disconnect: true } } : {})
        }
      })

      await tx.activityLog.create({
        data: {
          task_id: task.id,
          project_id: task.project_id,
          action: 'Task details updated',
          performed_by: session?.user?.id || null,
        }
      })

      return task
    })

    revalidatePath('/', 'layout')
    return { success: true, task: result }
  } catch (error) {
    console.error('Error updating task:', error)
    return { success: false, error: 'Failed to update task' }
  }
}
// Additional actions to append to tasks.ts
export async function addTaskFile(data: any) {
  try {
    const file = await prisma.taskFile.create({
      data: {
        task_id: data.task_id,
        file_name: data.file_name,
        file_url: data.file_url,
        file_size: data.file_size
      }
    })

    // Sync to FileRecord for File Manager visibility
    try {
      const storagePath = data.file_url?.split('/agencyos_files/')[1] || data.file_url
      await prisma.fileRecord.create({
        data: {
          name: data.file_name,
          url: data.file_url,
          storage_path: storagePath,
          size: data.file_size ?? null,
          category: 'deliverable',
          task_id: data.task_id,
          uploaded_by: data.uploaded_by ?? null,
          uploader_name: data.uploader_name ?? null,
        }
      })
    } catch (syncErr) {
      console.warn('FileRecord sync failed for task file:', syncErr)
    }

    revalidatePath('/my-tasks')
    return { success: true, file }
  } catch (error) {
    console.error('Error adding task file:', error)
    return { success: false, error: 'Failed to add task file' }
  }
}

export async function deleteTaskFile(id: string) {
  try {
    await prisma.taskFile.delete({
      where: { id }
    })
    revalidatePath('/my-tasks')
    return { success: true }
  } catch (error) {
    console.error('Error deleting task file:', error)
    return { success: false, error: 'Failed to delete task file' }
  }
}

export async function getTaskActivity(taskId: string) {
  try {
    const logs = await prisma.activityLog.findMany({
      where: { task_id: taskId },
      orderBy: { performed_at: 'desc' },
      include: {
        performer: { select: { name: true } }
      }
    })
    return logs
  } catch (error) {
    console.error('Error fetching task activity:', error)
    return []
  }
}

export async function logActivity(data: { task_id?: string, project_id?: string, action: string, metadata?: any }) {
  try {
    const session = await auth()
    await prisma.activityLog.create({
      data: {
        ...data,
        performed_by: session?.user?.id
      }
    })
    return { success: true }
  } catch (error) {
    console.error('Error logging activity:', error)
    return { success: false, error: 'Failed to log activity' }
  }
}

export async function createSubtask(taskId: string, title: string) {
  try {
    const subtask = await prisma.subtask.create({
      data: { task_id: taskId, title }
    })
    revalidatePath('/', 'layout')
    return { success: true, subtask }
  } catch (error) {
    console.error('Error creating subtask:', error)
    return { success: false, error: 'Failed to create subtask' }
  }
}

export async function toggleSubtask(id: string, is_completed: boolean) {
  try {
    const subtask = await prisma.subtask.update({
      where: { id },
      data: { is_completed }
    })
    revalidatePath('/', 'layout')
    return { success: true, subtask }
  } catch (error) {
    console.error('Error toggling subtask:', error)
    return { success: false, error: 'Failed to toggle subtask' }
  }
}

export async function deleteSubtask(id: string) {
  try {
    await prisma.subtask.delete({
      where: { id }
    })
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Error deleting subtask:', error)
    return { success: false, error: 'Failed to delete subtask' }
  }
}

export async function addTaskComment(taskId: string, comment: string) {
  try {
    const session = await auth()
    
    await prisma.activityLog.create({
      data: {
        task_id: taskId,
        action: 'commented',
        performed_by: session?.user?.id || null,
        metadata: { comment }
      }
    })
    
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Error adding task comment:', error)
    return { success: false, error: 'Failed to add comment' }
  }
}
