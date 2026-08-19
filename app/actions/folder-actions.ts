'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

async function getUserContext(): Promise<{ orgId: string | null; uid: string | null; isAdmin: boolean }> {
  const session = await auth()
  if (!session?.user?.id) return { orgId: null, uid: null, isAdmin: false }
  
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  })
  
  return { 
    orgId: user?.orgId ?? null, 
    uid: session.user.id, 
    isAdmin: user?.role?.name === 'admin' 
  }
}

// ─── Get Folders ─────────────────────────────────────────────────────────────

export async function getAllFolders() {
  try {
    const { orgId, uid, isAdmin } = await getUserContext()
    if (!orgId || !uid) return { success: false, error: 'Unauthorized', folders: [] }

    const where: any = { orgId }

    if (!isAdmin) {
      where.OR = [
        { created_by: uid },
        {
          files: {
            some: {
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
            }
          }
        }
      ]
    }

    const folders = await (prisma as any).fileFolder.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        files: { select: { id: true } },
      },
    })

    return { success: true, folders }
  } catch (error: any) {
    console.error('getAllFolders error:', error)
    return { success: false, error: error.message, folders: [] }
  }
}

export async function getFolders(context: string, contextId?: string) {
  try {
    const { orgId, uid, isAdmin } = await getUserContext()
    if (!orgId || !uid) return { success: false, error: 'Unauthorized', folders: [] }

    const where: any = {
      orgId,
      context,
      context_id: contextId ?? null,
    }

    if (!isAdmin) {
      where.OR = [
        { created_by: uid },
        {
          files: {
            some: {
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
            }
          }
        }
      ]
    }

    const folders = await (prisma as any).fileFolder.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        files: { select: { id: true } },
      },
    })

    return { success: true, folders }
  } catch (error: any) {
    console.error('getFolders error:', error)
    return { success: false, error: error.message, folders: [] }
  }
}

// ─── Create Folder ────────────────────────────────────────────────────────────

export async function createFolder(
  name: string,
  context: string,
  contextId?: string
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { orgId: true },
    })
    if (!user?.orgId) return { success: false, error: 'No org found' }

    const folder = await (prisma as any).fileFolder.create({
      data: {
        name: name.trim(),
        context,
        context_id: contextId ?? null,
        created_by: session.user.id,
        orgId: user.orgId,
      },
    })

    revalidatePath('/files')
    return { success: true, folder }
  } catch (error: any) {
    console.error('createFolder error:', error)
    return { success: false, error: error.message }
  }
}

// ─── Rename Folder ────────────────────────────────────────────────────────────

export async function renameFolder(id: string, name: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const folder = await (prisma as any).fileFolder.update({
      where: { id },
      data: { name: name.trim() },
    })

    revalidatePath('/files')
    return { success: true, folder }
  } catch (error: any) {
    console.error('renameFolder error:', error)
    return { success: false, error: error.message }
  }
}

// ─── Delete Folder ────────────────────────────────────────────────────────────
// Files inside are moved to root (folder_id = null)

export async function deleteFolder(id: string, deleteFiles: boolean = false) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    if (deleteFiles) {
      // Also delete all file records inside this folder
      const files = await prisma.fileRecord.findMany({
        where: { folder_id: id },
        select: { id: true, storage_path: true },
      })

      // Move files to root before deleting the folder
      await prisma.fileRecord.updateMany({
        where: { folder_id: id },
        data: { folder_id: null },
      })

      // Delete the folder
      await (prisma as any).fileFolder.delete({ where: { id } })
    } else {
      // Move files to root
      await prisma.fileRecord.updateMany({
        where: { folder_id: id },
        data: { folder_id: null },
      })

      // Delete the folder
      await (prisma as any).fileFolder.delete({ where: { id } })
    }

    revalidatePath('/files')
    return { success: true }
  } catch (error: any) {
    console.error('deleteFolder error:', error)
    return { success: false, error: error.message }
  }
}

// ─── Move File To Folder ──────────────────────────────────────────────────────

export async function moveFileToFolder(
  fileId: string,
  folderId: string | null
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    await prisma.fileRecord.update({
      where: { id: fileId },
      data: { folder_id: folderId },
    })

    revalidatePath('/files')
    return { success: true }
  } catch (error: any) {
    console.error('moveFileToFolder error:', error)
    return { success: false, error: error.message }
  }
}

// ─── Move Multiple Files ──────────────────────────────────────────────────────

export async function moveFilesToFolder(
  fileIds: string[],
  folderId: string | null
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    await prisma.fileRecord.updateMany({
      where: { id: { in: fileIds } },
      data: { folder_id: folderId },
    })

    revalidatePath('/files')
    return { success: true }
  } catch (error: any) {
    console.error('moveFilesToFolder error:', error)
    return { success: false, error: error.message }
  }
}
