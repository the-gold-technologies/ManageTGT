'use server'

import prisma from '@/lib/prisma'
import { auth } from '@/auth'
// import type { UserRole } from '@/types'
import { revalidatePath } from 'next/cache'
import bcrypt from 'bcryptjs'
import { createNotification } from './notifications'

export async function getCurrentProfile() {
  const session = await auth()
  if (!session?.user?.id) return null

  const profile = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  })

  if (!profile) return null

  return {
    id: profile.id,
    full_name: profile.name || 'User',
    email: profile.email || '',
    role: profile.role?.name || 'team_member',
    roleId: profile.roleId || undefined,
    avatar_url: profile.image || session.user.image || null,
    createdAt: profile.createdAt.toISOString(),
  }
}

export async function addTeamMember(data: {
  full_name: string
  email: string
  password?: string
  role: string
}) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, include: { role: true } })
    const currentUserRole = currentUser?.role?.name || 'team_member'
    
    if (!currentUser || !['admin', 'team_lead'].includes(currentUserRole)) {
      return { error: 'Forbidden' }
    }

    if (currentUserRole === 'team_lead' && data.role !== 'team_member') {
      return { error: 'Team Leads can only add Team Members' }
    }

    // Find the Role ID for the requested role name
    let roleRecord = await prisma.role.findUnique({ where: { name: data.role } })
    if (!roleRecord) {
      // Fallback if role doesn't exist, create it or default to team_member
      roleRecord = await prisma.role.findUnique({ where: { name: 'team_member' } })
    }

    const hashedPassword = await bcrypt.hash(data.password || 'Welcome@123', 10)

    await prisma.user.create({
      data: {
        name: data.full_name,
        email: data.email,
        password: hashedPassword,
        roleId: roleRecord?.id || null
      }
    })

    await prisma.activityLog.create({
      data: {
        action: `Added Team Member: ${data.full_name}`,
        performed_by: session.user.id
      }
    })

    revalidatePath('/team')
    return { success: true }
  } catch (error: any) {
    console.error('Error adding team member:', error)
    if (error.code === 'P2002') return { error: 'Email already exists' }
    return { error: 'Failed to add team member' }
  }
}

export async function updateMemberRole(userId: string, newRole: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, include: { role: true } })
    const currentUserRole = currentUser?.role?.name || 'team_member'

    if (!currentUser || currentUserRole !== 'admin') {
      return { error: 'Only admins can update roles' }
    }

    const roleRecord = await prisma.role.findUnique({ where: { name: newRole } })

    await prisma.user.update({
      where: { id: userId },
      data: { roleId: roleRecord?.id || null }
    })

    const newRoleLabel = newRole.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())

    await prisma.activityLog.create({
      data: {
        action: `Updated Role for user ID ${userId} to ${newRoleLabel}`,
        performed_by: session.user.id
      }
    })

    revalidatePath('/team')
    revalidatePath('/settings')
    return { success: true }
  } catch (error) {
    console.error('Error updating role:', error)
    return { error: 'Failed to update role' }
  }
}

export async function updateTeamMember(userId: string, data: {
  full_name: string
  email: string
  password?: string
  role: string
}) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, include: { role: true } })
    const currentUserRole = currentUser?.role?.name || 'team_member'

    if (!currentUser || !['admin', 'team_lead'].includes(currentUserRole)) {
      return { error: 'Forbidden' }
    }

    const roleRecord = await prisma.role.findUnique({ where: { name: data.role } })

    const updateData: any = {
      name: data.full_name,
      email: data.email,
      roleId: roleRecord?.id || null
    }

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10)
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData
    })

    await prisma.activityLog.create({
      data: {
        action: `Updated details for Team Member: ${updateData.name}`,
        performed_by: session.user.id
      }
    })

    revalidatePath('/team')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating team member:', error)
    if (error.code === 'P2002') return { error: 'Email already exists' }
    return { error: 'Failed to update team member' }
  }
}

export async function removeTeamMember(userId: string) {
  try {
    const session = await auth()
    if (!session?.user) return { error: 'Unauthorized' }

    const currentUser = await prisma.user.findUnique({ where: { id: session.user.id }, include: { role: true } })
    const currentUserRole = currentUser?.role?.name || 'team_member'

    if (!currentUser || currentUserRole !== 'admin') {
      return { error: 'Only admins can remove members' }
    }

    await prisma.user.delete({
      where: { id: userId }
    })

    await prisma.activityLog.create({
      data: {
        action: `Removed Team Member (ID: ${userId})`,
        performed_by: session.user.id
      }
    })

    revalidatePath('/team')
    return { success: true }
  } catch (error) {
    console.error('Error removing team member:', error)
    return { error: 'Failed to remove team member' }
  }
}

export async function getTeamMembers() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: { role: true }
    })
    return users.map(u => ({
      id: u.id,
      full_name: u.name,
      email: u.email,
      role: u.role?.name || 'team_member',
      roleId: u.roleId || undefined,
      avatar_url: u.image,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }))
  } catch (error) {
    console.error('Error fetching team:', error)
    return []
  }
}
