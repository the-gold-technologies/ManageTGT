'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getTasks() {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        assignee: {
          select: { id: true, name: true }
        },
        assigner: {
          select: { id: true, name: true }
        },
        project: {
          select: { id: true, name: true, project_code: true }
        },
        files: true
      },
      orderBy: { createdAt: 'desc' }
    })
    return tasks.map(t => ({
      ...t,
      assignee: t.assignee ? { id: t.assignee.id, full_name: t.assignee.name } : null,
      assigner: t.assigner ? { id: t.assigner.id, full_name: t.assigner.name } : null
    }))
  } catch (error) {
    console.error('Error fetching tasks:', error)
    return []
  }
}

export async function updateTaskStatus(id: string, status: any, completion_date?: string) {
  try {
    await prisma.task.update({
      where: { id },
      data: { 
        status, 
        ...(completion_date ? { completion_date: new Date(completion_date) } : {})
      }
    })
    revalidatePath('/tasks')
    return { success: true }
  } catch (error) {
    console.error('Error updating task status:', error)
    return { success: false, error: 'Failed to update task' }
  }
}

export async function deleteTask(id: string) {
  try {
    await prisma.task.delete({
      where: { id }
    })
    revalidatePath('/tasks')
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
    const { project_id, assigned_to, assigned_by, ...restData } = data
    const assignerId = session?.user?.id || assigned_by

    const task = await prisma.task.create({
      data: {
        ...restData,
        ...(project_id ? { project: { connect: { id: project_id } } } : {}),
        ...(assigned_to ? { assignee: { connect: { id: assigned_to } } } : {}),
        ...(assignerId ? { assigner: { connect: { id: assignerId } } } : {})
      }
    })
    revalidatePath('/tasks')
    return { success: true, task }
  } catch (error) {
    console.error('Error creating task:', error)
    return { success: false, error: 'Failed to create task' }
  }
}

export async function updateTask(id: string, data: any) {
  try {
    const { project_id, assigned_to, assigned_by, ...restData } = data

    const task = await prisma.task.update({
      where: { id },
      data: {
        ...restData,
        ...(project_id !== undefined ? { project: project_id ? { connect: { id: project_id } } : { disconnect: true } } : {}),
        ...(assigned_to !== undefined ? { assignee: assigned_to ? { connect: { id: assigned_to } } : { disconnect: true } } : {}),
        ...(assigned_by !== undefined ? { assigner: assigned_by ? { connect: { id: assigned_by } } : { disconnect: true } } : {})
      }
    })
    revalidatePath('/tasks')
    return { success: true, task }
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
    revalidatePath('/tasks')
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
    revalidatePath('/tasks')
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
