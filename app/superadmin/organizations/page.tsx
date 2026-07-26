import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { getOrganizations } from '@/app/actions/superadmin'
import SuperAdminClient from './superadmin-client'

export default async function SuperAdminPage() {
  const session = await auth()
  
  if (!session?.user?.isSuperAdmin) {
    redirect('/') // Or some unauthorized page
  }

  const organizations = await getOrganizations()

  return (
    <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-[#0f1115]">
      <div className="p-6 md:p-8 w-full max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Superadmin Dashboard</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Manage platform organizations and tenants</p>
          </div>
        </div>
        
        <SuperAdminClient initialOrganizations={organizations} />
      </div>
    </div>
  )
}
