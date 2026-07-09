import SettingsClient from '@/components/settings/settings-client'
import { getCurrentProfile } from '@/app/actions/team'
import { getRoles } from '@/app/actions/roles'
import { getServices } from '@/app/actions/services'
import { getRoleModuleAccess } from '@/app/actions/access'
import prisma from '@/lib/prisma'

export default async function SettingsPage() {
  const profile = await getCurrentProfile()
  
  let initialAdminData = null
  if (profile?.role === 'admin') {
    const [roles, services, access] = await Promise.all([
      getRoles(),
      getServices(),
      getRoleModuleAccess()
    ])
    initialAdminData = { roles, services, access }
  }

  const DEFAULT_MODULES = ['dashboard', 'settings', 'tasks', 'settings-profile']
  let allowedModules: string[] = [...DEFAULT_MODULES]
  if (profile?.id) {
    const dbUser = await prisma.user.findUnique({
      where: { id: profile.id },
      include: { role: true }
    })
    const roleId = dbUser?.roleId
    if (roleId) {
      const accessRecords = await prisma.roleModuleAccess.findMany({
        where: { roleId, hasAccess: true }
      })
      allowedModules = Array.from(new Set([...allowedModules, ...accessRecords.map(a => a.moduleKey)]))
    }
    if (dbUser?.role?.name === 'admin') {
      allowedModules = ['dashboard', 'clients', 'projects', 'tasks', 'revenue', 'expenses', 'profitability', 'prospects', 'targets', 'analytics', 'team', 'activity', 'settings', 'settings-profile', 'settings-roles', 'settings-services', 'settings-access']
    }
  }

  return (
    <SettingsClient 
      currentProfile={profile as any} 
      initialAdminData={initialAdminData} 
      allowedModules={allowedModules}
    />
  )
}
