import ProjectsClient from '@/components/projects/projects-client'
import { getProjects } from '@/app/actions/projects'
import { getClients } from '@/app/actions/clients'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import type { Project, Client, Profile } from '@/types'

export default async function ProjectsPage() {
  const session = await auth()
  // Role is already in JWT — no extra DB call needed
  const userRole = (session?.user as any)?.role || 'team_member'

  // Run all independent queries in parallel instead of sequentially
  const [allProjects, clients, profiles] = await Promise.all([
    getProjects(),
    getClients(),
    prisma.user.findMany({ select: { id: true, name: true, role: true } }),
  ])

  let projects = allProjects
  if (userRole === 'team_lead') {
    projects = allProjects.filter(p => p.team_lead_id === session?.user?.id)
  }

  const formattedProfiles = profiles.map(p => ({
    id: p.id,
    full_name: p.name || 'User',
    role: p.role
  }))

  return (
    <ProjectsClient
      initialProjects={(projects as unknown as Project[]) ?? []}
      clients={(clients as unknown as Client[]) ?? []}
      profiles={(formattedProfiles as unknown as Profile[]) ?? []}
      userRole={userRole}
    />
  )
}
