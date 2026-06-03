import TeamClient from '@/components/team/team-client'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import type { Profile } from '@/types'

export default async function TeamPage() {
  const session = await auth()
  if (!session?.user) {
    return redirect('/login')
  }

  // Role is already in JWT — no extra DB call needed
  const userRole = (session.user as any)?.role || 'team_member'

  if (!['admin', 'team_lead'].includes(userRole)) {
    return redirect('/') // Restrict access to Team Members and Sales Executives
  }

  const profiles = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' }
  })

  const formattedProfiles = profiles.map(p => ({
    id: p.id,
    full_name: p.name || 'User',
    email: p.email || '',
    role: p.role,
    avatar_url: p.image || null,
    createdAt: p.createdAt.toISOString(),
  }))

  return <TeamClient initialProfiles={(formattedProfiles as unknown as Profile[]) ?? []} userRole={userRole} />
}
