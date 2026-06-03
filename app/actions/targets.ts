'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getSalesTargets() {
  try {
    const targets = await prisma.salesTarget.findMany({
      orderBy: [{ year: 'desc' }, { month: 'desc' }]
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
        client: { select: { name: true } }
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
    const target = await prisma.salesTarget.upsert({
      where: {
        service_type_month_year: {
          service_type: data.service_type,
          month: data.month,
          year: data.year
        }
      },
      update: {
        target_count: data.target_count
      },
      create: {
        ...data,
        created_by: session?.user?.id
      }
    })
    revalidatePath('/targets')
    return { success: true, target }
  } catch (error) {
    console.error('Error upserting target:', error)
    return { success: false, error: 'Failed to set target' }
  }
}
