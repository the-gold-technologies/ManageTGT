'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function getRoles() {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: 'asc' },
    })
    return roles
  } catch (error) {
    console.error('Error fetching roles:', error)
    return []
  }
}

export async function createRole(data: { name: string; description?: string }) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    // Ensure the role name doesn't already exist
    const existing = await prisma.role.findUnique({
      where: { name: data.name }
    })
    if (existing) return { error: 'Role name already exists' }

    const newRole = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description || '',
      }
    })

    revalidatePath('/settings')
    return { success: true, role: newRole }
  } catch (error) {
    console.error('Error creating role:', error)
    return { error: 'Failed to create role' }
  }
}

export async function updateRole(id: string, data: { name: string; description?: string }) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const role = await prisma.role.findUnique({ where: { id } })
    if (!role) return { error: 'Role not found' }
    if (role.isSystem) return { error: 'System roles cannot be renamed' }

    await prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
      }
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Error updating role:', error)
    return { error: 'Failed to update role' }
  }
}

export async function deleteRole(id: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const role = await prisma.role.findUnique({ where: { id } })
    if (!role) return { error: 'Role not found' }
    if (role.isSystem) return { error: 'System roles cannot be deleted' }

    await prisma.role.delete({
      where: { id }
    })

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Error deleting role:', error)
    return { error: 'Failed to delete role' }
  }
}
