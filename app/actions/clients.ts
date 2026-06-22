'use server'

import prisma from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'

export async function getClients() {
  try {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' }
    })
    return clients
  } catch (error) {
    console.error('Error fetching clients:', error)
    return []
  }
}

export async function createClient(data: any) {
  try {
    const session = await auth()
    const client = await prisma.client.create({
      data: {
        ...data,
        createdBy: session?.user?.id
      }
    })
    revalidatePath('/clients')
    return { success: true, data: client }
  } catch (error: any) {
    console.error('Error creating client:', error)
    return { success: false, error: error.message || 'Failed to create client' }
  }
}

export async function checkClientExists(email: string) {
  try {
    const existing = await prisma.client.findFirst({
      where: { email },
      select: { id: true, name: true }
    })
    return { exists: !!existing, client: existing }
  } catch (error) {
    return { exists: false, client: null }
  }
}

export async function updateClient(id: string, data: any) {
  try {
    const client = await prisma.client.update({
      where: { id },
      data
    })
    revalidatePath('/clients')
    return { success: true, data: client }
  } catch (error: any) {
    console.error('Error updating client:', error)
    return { success: false, error: error.message || 'Failed to update client' }
  }
}

export async function deleteClient(id: string) {
  try {
    await prisma.client.delete({
      where: { id }
    })
    revalidatePath('/clients')
    return { success: true }
  } catch (error) {
    console.error('Error deleting client:', error)
    return { success: false, error: 'Failed to delete client' }
  }
}
