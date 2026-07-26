import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import { basePrisma } from '@/lib/prisma'

export default async function SuperadminDashboardPage() {
  const session = await auth()
  
  if (!session?.user?.isSuperAdmin) {
    redirect('/')
  }

  // Get high-level stats
  const totalOrgs = await basePrisma.organization.count()

  return (
    <div className="flex flex-col h-full bg-bg">
      <div className="p-6 md:p-8 w-full max-w-7xl mx-auto space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-bg-secondary p-6 rounded-xl border border-border shadow-card">
            <h3 className="text-text-secondary text-sm font-medium">Total Organizations</h3>
            <p className="text-3xl font-bold text-text mt-2">{totalOrgs}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
