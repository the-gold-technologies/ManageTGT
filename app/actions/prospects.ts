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
    revalidatePath('/finance/prospects')
    return { success: true, prospect }
  } catch (error) {
    console.error('Error creating prospect:', error)
    return { success: false, error: 'Failed to create prospect' }
  }
}

export async function updateProspect(id: string, data: any) {
  try {
    const { proposal_submission_date, ...rest } = data
    const prospect = await prisma.prospect.update({
      where: { id },
      data: {
        ...rest,
        proposal_submission_date: proposal_submission_date ? new Date(proposal_submission_date) : null
      }
    })
    revalidatePath('/finance/prospects')
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
    revalidatePath('/finance/prospects')
    return { success: true }
  } catch (error) {
    console.error('Error deleting prospect:', error)
    return { success: false, error: 'Failed to delete prospect' }
  }
}
