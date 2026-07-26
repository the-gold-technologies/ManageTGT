'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getSalesTargets() {
  try {
    const targets = await prisma.salesTarget.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return targets
  } catch (error) {
    console.error('Error fetching targets:', error)
    return []
  }
}

export async function getSalesClosures() {
  try {
    const closures = await prisma.salesClosure.findMany({
      include: {
        closer: { select: { name: true } },
        client: { select: { name: true } },
        project: { select: { name: true, quoted_price: true } }
      },
      orderBy: { closed_at: 'desc' }
    })
    return closures.map(c => ({
      ...c,
      closer: c.closer ? { full_name: c.closer.name } : null
    }))
  } catch (error) {
    console.error('Error fetching closures:', error)
    return []
  }
}

import { auth } from '@/auth'

export async function upsertTarget(data: any) {
  try {
    const session = await auth()
    const existing = await prisma.salesTarget.findFirst({
      where: {
        service_type: data.service_type,
        month: data.month,
        year: data.year
      }
    })

    let target;
    if (existing) {
      target = await prisma.salesTarget.update({
        where: { id: existing.id },
        data: {
          target_count: data.target_count,
          average_cost: data.average_cost
        }
      })
    } else {
      target = await prisma.salesTarget.create({
        data: {
          service_type: data.service_type,
          month: data.month,
          year: data.year,
          target_count: data.target_count,
          average_cost: data.average_cost,
          created_by: session?.user?.id
        }
      })
    }
    revalidatePath('/targets')
    return { success: true, target }
  } catch (error) {
    console.error('Error upserting target:', error)
    return { success: false, error: 'Failed to set target' }
  }
}

export async function deleteTarget(id: string) {
  try {
    await prisma.salesTarget.delete({
      where: { id }
    })
    revalidatePath('/targets')
    return { success: true }
  } catch (error) {
    console.error('Error deleting target:', error)
    return { success: false, error: 'Failed to delete target' }
  }
}
