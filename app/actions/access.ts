'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'

export async function getRoleModuleAccess() {
  try {
    const access = await prisma.roleModuleAccess.findMany()
    return access
  } catch (error) {
    console.error('Error fetching role module access:', error)
    return []
  }
}

export async function updateRoleModuleAccess(roleId: string, moduleKey: string, hasAccess: boolean) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    // Check if mapping exists
    const existing = await prisma.roleModuleAccess.findUnique({
      where: {
        roleId_moduleKey: { roleId, moduleKey }
      }
    })

    if (existing) {
      await prisma.roleModuleAccess.update({
        where: { id: existing.id },
        data: { hasAccess }
      })
    } else {
      await prisma.roleModuleAccess.create({
        data: {
          roleId,
          moduleKey,
          hasAccess
        }
      })
    }

    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Error updating access:', error)
    return { error: 'Failed to update access' }
  }
}
