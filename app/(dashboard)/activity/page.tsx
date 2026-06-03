import ActivityClient from '@/components/activity/activity-client'
import { getActivities } from '@/app/actions/activity'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export const metadata = {
  title: 'Activity Logs | AgencyOS',
}

export default async function ActivityPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } })
  const role = dbUser?.role || 'team_member'

  const activities = await getActivities()

  return <ActivityClient initialActivities={activities as any} userRole={role} />
}
