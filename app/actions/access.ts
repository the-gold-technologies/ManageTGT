'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

export async function verifyModuleAccess(moduleKey: string) {
  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  })

  if (!dbUser) {
    redirect('/login')
  }

  const roleName = dbUser.role?.name || 'team_member'
  if (roleName === 'admin') return

  const DEFAULT_MODULES = ['dashboard', 'settings', 'tasks', 'files']
  if (DEFAULT_MODULES.includes(moduleKey)) return

  const roleId = dbUser.roleId
  if (!roleId) {
    redirect('/')
  }

  const access = await prisma.roleModuleAccess.findUnique({
    where: {
      roleId_moduleKey: { roleId, moduleKey }
    }
  })

  if (!access || !access.hasAccess) {
    redirect('/')
  }
}

