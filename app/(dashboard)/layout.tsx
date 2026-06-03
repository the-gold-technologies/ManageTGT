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
  })

  const userProfile = {
    id: dbUser?.id || session.user.id || '',
    full_name: dbUser?.name || session.user.name || session.user.email || 'User',
    role: dbUser?.role || 'team_member',
    avatar_url: dbUser?.image || undefined,
    createdAt: dbUser?.createdAt.toISOString() || new Date().toISOString(),
    updatedAt: dbUser?.updatedAt.toISOString() || new Date().toISOString(),
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar userRole={userProfile.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar user={userProfile} />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
