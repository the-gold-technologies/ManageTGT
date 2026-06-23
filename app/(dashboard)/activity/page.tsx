import ActivityClient from '@/components/activity/activity-client'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export const metadata = {
  title: 'Activity Logs | TGT',
}

export default async function ActivityPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id }, include: { role: true } })
  const role = dbUser?.role?.name || 'team_member'

  return <ActivityClient initialActivities={[]} userRole={role} />
}
