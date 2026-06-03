import ProjectsClient from '@/components/projects/projects-client'
import { getProjects } from '@/app/actions/projects'
import { getClients } from '@/app/actions/clients'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import type { Project, Client, Profile } from '@/types'

export default async function ProjectsPage() {
  const session = await auth()
  const dbUser = await prisma.user.findUnique({ where: { id: session?.user?.id || '' } })
  const userRole = dbUser?.role || 'team_member'

  const allProjects = await getProjects()
  let projects = allProjects
  if (userRole === 'team_lead') {
    projects = allProjects.filter(p => p.team_lead_id === session?.user?.id)
  }

  const clients = await getClients()
  const profiles = await prisma.user.findMany({ select: { id: true, name: true, role: true } })

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
