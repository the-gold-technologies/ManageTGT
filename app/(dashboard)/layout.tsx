import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/sidebar'
import TopBar from '@/components/layout/topbar'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  })

  const userProfile = {
    id: dbUser?.id || session.user.id || '',
    full_name: dbUser?.name || session.user.name || session.user.email || 'User',
    // Always use the real role from the database rather than stale JWT
    role: dbUser?.role?.name || 'team_member',
    avatar_url: dbUser?.image || session.user.image || undefined,
    createdAt: dbUser?.createdAt.toISOString() || new Date().toISOString(),
    updatedAt: dbUser?.updatedAt.toISOString() || new Date().toISOString(),
  }

  const roleId = dbUser?.roleId
  const roleName = userProfile.role

  const DEFAULT_MODULES = ['dashboard', 'settings', 'tasks', 'calendar']

  let allowedModules: string[] = [...DEFAULT_MODULES]
  if (roleId) {
    const accessRecords = await prisma.roleModuleAccess.findMany({
      where: { roleId, hasAccess: true }
    })
    allowedModules = Array.from(new Set([...allowedModules, ...accessRecords.map(a => a.moduleKey)]))
  }
  // Admin always has all access
  if (roleName === 'admin') {
    allowedModules = ['dashboard', 'clients', 'projects', 'tasks', 'revenue', 'expenses', 'profitability', 'prospects', 'targets', 'analytics', 'team', 'activity', 'settings', 'calendar', 'files']
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar allowedModules={allowedModules} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar user={userProfile} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
