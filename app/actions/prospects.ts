'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getProspects() {
  try {
    const prospects = await prisma.prospect.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return prospects
  } catch (error) {
    console.error('Error fetching prospects:', error)
    return []
  }
}

export async function createProspect(data: any) {
  try {
    const { proposal_submission_date, ...rest } = data
    const prospect = await prisma.prospect.create({
      data: {
        ...rest,
        proposal_submission_date: proposal_submission_date ? new Date(proposal_submission_date) : null
      }
    })

    // Sync document_urls to FileRecord
    const urls: string[] = data.document_urls ?? []
    if (urls.length > 0) {
      const syncData = urls.map((url: string) => ({
        name: url.split('/').pop() || 'document',
        url,
        storage_path: url.split('/agencyos_files/')[1] || url,
        category: 'reference' as const,
        prospect_id: prospect.id,
        uploaded_by: null as string | null,
        uploader_name: null as string | null,
      }))
      try {
        await prisma.fileRecord.createMany({ data: syncData })
      } catch (e) {
        console.warn('FileRecord sync failed for prospect create:', e)
      }
    }

    revalidatePath('/growth/prospects')
    return { success: true, prospect }
  } catch (error) {
    console.error('Error creating prospect:', error)
    return { success: false, error: 'Failed to create prospect' }
  }
}

export async function updateProspect(id: string, data: any) {
  try {
    const existing = await prisma.prospect.findUnique({ where: { id }, select: { document_urls: true } })
    const { proposal_submission_date, ...rest } = data
    const prospect = await prisma.prospect.update({
      where: { id },
      data: {
        ...rest,
        proposal_submission_date: proposal_submission_date ? new Date(proposal_submission_date) : null
      }
    })

    // Sync newly added document_urls to FileRecord
    const prevUrls = (existing?.document_urls ?? []) as string[]
    const newUrls = (data.document_urls ?? []).filter((u: string) => !prevUrls.includes(u))
    if (newUrls.length > 0) {
      const syncData = newUrls.map((url: string) => ({
        name: url.split('/').pop() || 'document',
        url,
        storage_path: url.split('/agencyos_files/')[1] || url,
        category: 'reference' as const,
        prospect_id: id,
        uploaded_by: null as string | null,
        uploader_name: null as string | null,
      }))
      try {
        await prisma.fileRecord.createMany({ data: syncData })
      } catch (e) {
        console.warn('FileRecord sync failed for prospect update:', e)
      }
    }

    revalidatePath('/growth/prospects')
    return { success: true, prospect }
  } catch (error) {
    console.error('Error updating prospect:', error)
    return { success: false, error: 'Failed to update prospect' }
  }
}

export async function deleteProspect(id: string) {
  try {
    await prisma.prospect.delete({
      where: { id }
    })
    revalidatePath('/growth/prospects')
    return { success: true }
  } catch (error) {
    console.error('Error deleting prospect:', error)
    return { success: false, error: 'Failed to delete prospect' }
  }
}
