import SettingsClient from '@/components/settings/settings-client'
import { getCurrentProfile } from '@/app/actions/team'

export default async function SuperadminSettingsPage() {
  const profile = await getCurrentProfile()
  
  // Superadmins only need the profile tab for now
  const allowedModules = ['settings-profile']

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="p-6 md:p-8 w-full max-w-5xl space-y-6">

        <SettingsClient 
          currentProfile={profile as any} 
          initialAdminData={null} 
          allowedModules={allowedModules}
        />
      </div>
    </div>
  )
}
