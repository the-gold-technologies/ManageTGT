'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { processDueFollowUps } from '@/lib/follow-up-processor'

// ─────────────────────────────────────────────────────────────
// CRUD
// ─────────────────────────────────────────────────────────────

export async function getFollowUps(prospectId: string) {
  try {
    const followUps = await prisma.prospectFollowUp.findMany({
      where: { prospect_id: prospectId },
      orderBy: { scheduled_date: 'asc' },
    })
    return followUps
  } catch (error) {
    console.error('Error fetching follow-ups:', error)
    return []
  }
}

export async function createFollowUp(data: {
  prospect_id: string
  scheduled_date: string
  channel: 'email' | 'whatsapp' | 'manual'
  note?: string
}) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    })
    
    const isAdmin = dbUser?.role?.name === 'admin' || dbUser?.isSuperAdmin
    const is_approved = data.channel === 'manual'

    const followUp = await prisma.prospectFollowUp.create({
      data: {
        prospect_id: data.prospect_id,
        scheduled_date: new Date(data.scheduled_date),
        channel: data.channel,
        note: data.note || null,
        status: 'pending',
        is_approved,
        created_by: session.user.id,
      },
    })

    revalidatePath('/growth/prospects')
    return { success: true, followUp }
  } catch (error) {
    console.error('Error creating follow-up:', error)
    return { success: false, error: 'Failed to create follow-up' }
  }
}

export async function updateFollowUp(
  id: string,
  data: {
    scheduled_date?: string
    note?: string
    status?: 'pending' | 'sent' | 'skipped' | 'failed'
  }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const followUp = await prisma.prospectFollowUp.update({
      where: { id },
      data: {
        ...(data.scheduled_date && { scheduled_date: new Date(data.scheduled_date) }),
        ...(data.note !== undefined && { note: data.note || null }),
        ...(data.status && { status: data.status }),
      },
    })

    revalidatePath('/growth/prospects')
    return { success: true, followUp }
  } catch (error) {
    console.error('Error updating follow-up:', error)
    return { success: false, error: 'Failed to update follow-up' }
  }
}

export async function deleteFollowUp(id: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    await prisma.prospectFollowUp.delete({ where: { id } })
    revalidatePath('/growth/prospects')
    return { success: true }
  } catch (error) {
    console.error('Error deleting follow-up:', error)
    return { success: false, error: 'Failed to delete follow-up' }
  }
}

export async function approveFollowUp(id: string) {
  try {
    const session = await auth()
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    })
    const isAdmin = dbUser?.role?.name === 'admin' || dbUser?.isSuperAdmin
    if (!isAdmin) return { success: false, error: 'Only admins can approve follow-ups' }

    await prisma.prospectFollowUp.update({
      where: { id },
      data: {
        is_approved: true,
        approved_by: session.user.id,
        approved_at: new Date(),
      }
    })
    
    revalidatePath('/growth/prospects')
    return { success: true }
  } catch (error) {
    console.error('Error approving follow-up:', error)
    return { success: false, error: 'Failed to approve follow-up' }
  }
}

// ─────────────────────────────────────────────────────────────
// Trigger — delegates to the shared processor (usable from
// both this server action and the standalone cron script)
// ─────────────────────────────────────────────────────────────
export async function triggerDueFollowUps(orgId?: string) {
  try {
    return await processDueFollowUps(prisma, { orgId })
  } catch (error) {
    console.error('Error triggering follow-ups:', error)
    return { success: false, processed: 0, failed: 0, error: 'Failed to process follow-ups' }
  }
}
