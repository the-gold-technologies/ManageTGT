'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { createNotification } from './notifications'
import type { FileCategory } from '@prisma/client'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FileContext =
  | 'client'
  | 'project'
  | 'prospect'
  | 'task'
  | 'invoice'
  | 'expense'
  | 'all'

export interface GetFilesFilters {
  context?: FileContext
  contextId?: string
  category?: FileCategory
  search?: string
  includeArchived?: boolean
  /** If provided (non-admin), only return files where shared_with includes this userId */
  userId?: string
}

export interface CreateFileRecordInput {
  name: string
  url: string
  storage_path: string
  size?: number
  mime_type?: string
  category?: FileCategory
  source_date?: string | Date | null
  source_note?: string | null
  // context — only one should be set
  client_id?: string | null
  project_id?: string | null
  prospect_id?: string | null
  task_id?: string | null
  invoice_id?: string | null
  expense_id?: string | null
  // versioning
  parent_id?: string | null
  // uploader (pass explicitly from server actions that already have session)
  uploaded_by?: string | null
  uploader_name?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function isAdmin(): Promise<boolean> {
  const session = await auth()
  if (!session?.user?.id) return false
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  })
  return user?.role?.name === 'admin'
}

// ─── Get Files ────────────────────────────────────────────────────────────────

export async function getFiles(filters: GetFilesFilters = {}) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized', files: [] }

    const admin = await isAdmin()
    const { context, contextId, category, search, includeArchived = false, userId } = filters

    const where: any = {
      is_archived: includeArchived ? undefined : false,
      AND: [] as any[]
    }

    // Admin sees all; non-admin only sees files shared with them, uploaded by them, or belonging to their assigned projects/tasks
    if (!admin) {
      const uid = userId || session.user.id
      where.AND.push({
        OR: [
          { shared_with: { has: uid } },
          { uploaded_by: uid },
          {
            project: {
              OR: [
                { team_lead_id: uid },
                { assigned_member_ids: { has: uid } }
              ]
            }
          },
          {
            task: {
              OR: [
                { assigned_by: uid },
                { assigned_member_ids: { has: uid } }
              ]
            }
          }
        ]
      })
    }

    // Context filter
    if (context && context !== 'all' && contextId) {
      where[`${context}_id`] = contextId
    } else if (context && context !== 'all' && !contextId) {
      where[`${context}_id`] = { not: null }
    }

    // Category filter
    if (category) {
      where.category = category
    }

    // Search by name
    if (search) {
      where.AND.push({
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { source_note: { contains: search, mode: 'insensitive' } },
        ]
      })
    }

    if (where.AND.length === 0) {
      delete where.AND
    }

    const files = await prisma.fileRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true, project_code: true } },
        prospect: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        invoice: { select: { id: true, invoice_number: true } },
        expense: { select: { id: true, expense_type: true, description: true } },
      },
    })

    return { success: true, files }
  } catch (error: any) {
    console.error('getFiles error:', error)
    return { success: false, error: error.message, files: [] }
  }
}

// ─── Create File Record ───────────────────────────────────────────────────────

export async function createFileRecord(input: CreateFileRecordInput) {
  try {
    const session = await auth()

    // Determine next version number if this is a re-upload
    let version = 1
    if (input.parent_id) {
      const siblings = await prisma.fileRecord.count({
        where: { parent_id: input.parent_id },
      })
      version = siblings + 2 // parent = v1, first child = v2, etc.
    }

    const record = await prisma.fileRecord.create({
      data: {
        name: input.name,
        url: input.url,
        storage_path: input.storage_path,
        size: input.size ?? null,
        mime_type: input.mime_type ?? null,
        category: input.category ?? 'general',
        source_date: input.source_date ? new Date(input.source_date) : null,
        source_note: input.source_note ?? null,
        client_id: input.client_id ?? null,
        project_id: input.project_id ?? null,
        prospect_id: input.prospect_id ?? null,
        task_id: input.task_id ?? null,
        invoice_id: input.invoice_id ?? null,
        expense_id: input.expense_id ?? null,
        version,
        parent_id: input.parent_id ?? null,
        uploaded_by: input.uploaded_by ?? session?.user?.id ?? null,
        uploader_name: input.uploader_name ?? session?.user?.name ?? null,
      },
    })

    revalidatePath('/files')
    return { success: true, record }
  } catch (error: any) {
    console.error('createFileRecord error:', error)
    return { success: false, error: error.message }
  }
}

// ─── Bulk Create (used by existing server actions during sync) ────────────────

export async function createFileRecordsBulk(inputs: CreateFileRecordInput[]) {
  try {
    const session = await auth()
    const data = inputs.map((input) => ({
      name: input.name,
      url: input.url,
      storage_path: input.storage_path,
      size: input.size ?? null,
      mime_type: input.mime_type ?? null,
      category: (input.category ?? 'general') as FileCategory,
      source_date: input.source_date ? new Date(input.source_date) : null,
      source_note: input.source_note ?? null,
      client_id: input.client_id ?? null,
      project_id: input.project_id ?? null,
      prospect_id: input.prospect_id ?? null,
      task_id: input.task_id ?? null,
      invoice_id: input.invoice_id ?? null,
      expense_id: input.expense_id ?? null,
      version: 1,
      parent_id: null,
      uploaded_by: input.uploaded_by ?? session?.user?.id ?? null,
      uploader_name: input.uploader_name ?? session?.user?.name ?? null,
    }))

    await prisma.fileRecord.createMany({ data })
    revalidatePath('/files')
    return { success: true }
  } catch (error: any) {
    console.error('createFileRecordsBulk error:', error)
    return { success: false, error: error.message }
  }
}

// ─── Update File Record ───────────────────────────────────────────────────────

export async function updateFileRecord(
  id: string,
  input: {
    category?: FileCategory
    source_date?: string | Date | null
    source_note?: string | null
    shared_with?: string[]
    is_archived?: boolean
  }
) {
  try {
    const admin = await isAdmin()
    if (!admin) return { success: false, error: 'Admin only' }

    const record = await prisma.fileRecord.update({
      where: { id },
      data: {
        ...(input.category !== undefined && { category: input.category }),
        ...(input.source_date !== undefined && {
          source_date: input.source_date ? new Date(input.source_date) : null,
        }),
        ...(input.source_note !== undefined && { source_note: input.source_note }),
        ...(input.shared_with !== undefined && { shared_with: input.shared_with }),
        ...(input.is_archived !== undefined && { is_archived: input.is_archived }),
      },
    })

    revalidatePath('/files')
    return { success: true, record }
  } catch (error: any) {
    console.error('updateFileRecord error:', error)
    return { success: false, error: error.message }
  }
}

// ─── Share File With Users ────────────────────────────────────────────────────

export async function shareFileWithUsers(fileId: string, userIds: string[]) {
  try {
    const admin = await isAdmin()
    if (!admin) return { success: false, error: 'Admin only' }

    const existing = await prisma.fileRecord.findUnique({ where: { id: fileId } })
    if (!existing) return { success: false, error: 'File not found' }

    const merged = Array.from(new Set([...(existing.shared_with ?? []), ...userIds]))

    const record = await prisma.fileRecord.update({
      where: { id: fileId },
      data: { shared_with: merged },
    })

    const session = await auth()
    const sharerName = session?.user?.name || 'Someone'

    for (const userId of userIds) {
      if (!(existing.shared_with ?? []).includes(userId)) {
        await createNotification({
          user_id: userId,
          type: 'file_share',
          title: 'File Shared with You',
          message: `${sharerName} shared the file "${existing.name}" with you.`,
          link: '/files'
        })
      }
    }

    revalidatePath('/files')
    return { success: true, record }
  } catch (error: any) {
    console.error('shareFileWithUsers error:', error)
    return { success: false, error: error.message }
  }
}

// ─── Unshare File From Users ──────────────────────────────────────────────────

export async function unshareFileFromUsers(fileId: string, userIds: string[]) {
  try {
    const admin = await isAdmin()
    if (!admin) return { success: false, error: 'Admin only' }

    const existing = await prisma.fileRecord.findUnique({ where: { id: fileId } })
    if (!existing) return { success: false, error: 'File not found' }

    const filtered = (existing.shared_with ?? []).filter((uid) => !userIds.includes(uid))

    const record = await prisma.fileRecord.update({
      where: { id: fileId },
      data: { shared_with: filtered },
    })

    revalidatePath('/files')
    return { success: true, record }
  } catch (error: any) {
    console.error('unshareFileFromUsers error:', error)
    return { success: false, error: error.message }
  }
}

// ─── Delete File Record ───────────────────────────────────────────────────────

export async function deleteFileRecord(id: string) {
  try {
    const admin = await isAdmin()
    if (!admin) return { success: false, error: 'Admin only' }

    const record = await prisma.fileRecord.findUnique({ where: { id } })
    if (!record) return { success: false, error: 'Not found' }

    // Delete from Supabase storage
    if (record.storage_path) {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await supabase.storage.from('agencyos_files').remove([record.storage_path])
    }

    await prisma.fileRecord.delete({ where: { id } })

    revalidatePath('/files')
    return { success: true }
  } catch (error: any) {
    console.error('deleteFileRecord error:', error)
    return { success: false, error: error.message }
  }
}

// ─── Get File Versions ────────────────────────────────────────────────────────

export async function getFileVersions(fileId: string) {
  try {
    // fileId can be the parent OR any version in the chain
    const file = await prisma.fileRecord.findUnique({ where: { id: fileId } })
    if (!file) return { success: false, versions: [] }

    const rootId = file.parent_id ?? file.id

    const versions = await prisma.fileRecord.findMany({
      where: {
        OR: [{ id: rootId }, { parent_id: rootId }],
      },
      orderBy: { version: 'asc' },
    })

    return { success: true, versions }
  } catch (error: any) {
    console.error('getFileVersions error:', error)
    return { success: false, versions: [] }
  }
}

// ─── Get Files Shared With Me (for non-admin users) ───────────────────────────

export async function getMySharedFiles() {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, files: [] }

    const files = await prisma.fileRecord.findMany({
      where: {
        shared_with: { has: session.user.id },
        is_archived: false,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
        prospect: { select: { id: true, name: true } },
        task: { select: { id: true, title: true } },
        invoice: { select: { id: true, invoice_number: true } },
        expense: { select: { id: true, expense_type: true } },
      },
    })

    return { success: true, files }
  } catch (error: any) {
    console.error('getMySharedFiles error:', error)
    return { success: false, files: [] }
  }
}
