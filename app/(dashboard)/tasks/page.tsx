import TasksClient from '@/components/tasks/tasks-client'
import { getTasks } from '@/app/actions/tasks'
import { getProjects } from '@/app/actions/projects'
import prisma from '@/lib/prisma'
import { auth } from '@/auth'
import type { Task, Project, Profile } from '@/types'

export default async function TasksPage() {
  const session = await auth()
  const dbUser = await prisma.user.findUnique({ where: { id: session?.user?.id || '' } })
  const userRole = dbUser?.role || 'team_member'

  const allProjects = await getProjects()
  const teamLeadProjectIds = allProjects.filter(p => p.team_lead_id === session?.user?.id).map(p => p.id)

  const allTasks = await getTasks()
  let tasks = allTasks

  if (userRole === 'team_lead') {
    tasks = allTasks.filter(t => 
      teamLeadProjectIds.includes(t.project_id || '') || 
      t.assigned_by === session?.user?.id || 
      t.assigned_to === session?.user?.id
    )
  } else if (userRole === 'team_member') {
    tasks = allTasks.filter(t => t.assigned_to === session?.user?.id)
  }

  const projects = allProjects.filter(p => ['pending', 'in_progress', 'on_hold'].includes(p.status))
  const profiles = await prisma.user.findMany({ select: { id: true, name: true, role: true } })

  const formattedProfiles = profiles.map(p => ({
    id: p.id,
    full_name: p.name || 'User',
    role: p.role
  }))

  return (
    <TasksClient 
      initialTasks={(tasks as unknown as Task[]) ?? []} 
      projects={(projects as unknown as Project[]) ?? []} 
      profiles={(formattedProfiles as unknown as Profile[]) ?? []} 
      userRole={userRole} 
    />
  )
}
