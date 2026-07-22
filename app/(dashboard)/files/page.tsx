import { verifyModuleAccess } from '@/app/actions/access'
import { getFiles } from '@/app/actions/files'
import { getClients } from '@/app/actions/clients'
import { getProjects } from '@/app/actions/projects'
import { getCurrentProfile } from '@/app/actions/team'
import prisma from '@/lib/prisma'
import FileManagerClient from '@/components/files/file-manager-client'

const DEFAULT_MODULES = ['dashboard', 'settings', 'tasks', 'files']

export const metadata = {
  title: 'File Manager | AgencyOS',
  description: 'Manage all client and project files in one place',
}

export default async function FilesPage() {
  await verifyModuleAccess('files')

  const profile = await getCurrentProfile()

  const [filesResult, clients, projects, users, dbUser] = await Promise.all([
    getFiles({ context: 'all' }),
    getClients(),
    getProjects(),
    prisma.user.findMany({
      select: { id: true, name: true, image: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findUnique({
      where: { id: profile?.id },
      include: { role: { include: { permissions: true } } }
    })
  ])

  const roleName = dbUser?.role?.name || 'team_member'
  const isSystemAdmin = roleName === 'admin'
  
  const allowedModules = isSystemAdmin 
    ? ['admin'] // special flag
    : [
        ...DEFAULT_MODULES,
        ...(dbUser?.role?.permissions.filter(p => p.hasAccess).map(p => p.moduleKey) || [])
      ]

  return (
    <FileManagerClient
      initialFiles={(filesResult.files ?? []) as any}
      clients={clients as any}
      projects={projects as any}
      users={users}
      currentUserId={profile?.id ?? ''}
      allowedModules={allowedModules}
    />
  )
}
