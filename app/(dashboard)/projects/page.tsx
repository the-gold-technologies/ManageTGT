import ProjectsClient from '@/components/projects/projects-client'
import { auth } from '@/auth'
import { verifyModuleAccess } from '@/app/actions/access'
import prisma from '@/lib/prisma'

export default async function ProjectsPage() {
  await verifyModuleAccess('projects')
  const session = await auth()
  const dbUser = session?.user?.id 
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true }
      })
    : null
  const userRole = dbUser?.role?.name || 'team_member'

  return (
    <ProjectsClient
      initialProjects={[]}
      clients={[]}
      profiles={[]}
      userRole={userRole}
    />
  )
}
