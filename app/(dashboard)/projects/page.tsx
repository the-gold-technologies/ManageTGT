import ProjectsClient from '@/components/projects/projects-client'
import { auth } from '@/auth'

export default async function ProjectsPage() {
  const session = await auth()
  const userRole = (session?.user as any)?.role || 'team_member'

  return (
    <ProjectsClient
      initialProjects={[]}
      clients={[]}
      profiles={[]}
      userRole={userRole}
    />
  )
}
