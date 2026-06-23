'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function getServices() {
  try {
    const services = await prisma.serviceType.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return services
  } catch (error) {
    console.error('Error fetching services:', error)
    return []
  }
}

export async function createService(data: { name: string; description?: string }) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const existing = await prisma.serviceType.findUnique({
      where: { name: data.name }
    })
    if (existing) return { error: 'Service name already exists' }

    const newService = await prisma.serviceType.create({
      data: {
        name: data.name,
        description: data.description || '',
        isActive: true,
      }
    })

    revalidatePath('/settings')
    return { success: true, service: newService }
  } catch (error) {
    console.error('Error creating service:', error)
    return { error: 'Failed to create service' }
  }
}

export async function updateService(id: string, data: { name: string; description?: string; isActive?: boolean }) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    await prisma.serviceType.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive,
      }
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Error updating service:', error)
    return { error: 'Failed to update service' }
  }
}

export async function deleteService(id: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    await prisma.serviceType.delete({
      where: { id }
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Error deleting service:', error)
    return { error: 'Failed to delete service' }
  }
}
