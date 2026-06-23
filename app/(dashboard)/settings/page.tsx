import SettingsClient from '@/components/settings/settings-client'
import { getCurrentProfile } from '@/app/actions/team'
import { getRoles } from '@/app/actions/roles'
import { getServices } from '@/app/actions/services'
import { getRoleModuleAccess } from '@/app/actions/access'

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

  return <SettingsClient currentProfile={profile as any} initialAdminData={initialAdminData} />
}
