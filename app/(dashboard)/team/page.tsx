import TeamClient from '@/components/team/team-client'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { verifyModuleAccess } from '@/app/actions/access'
import prisma from '@/lib/prisma'

export default async function TeamPage() {
  await verifyModuleAccess('team')
  const session = await auth()
  if (!session?.user) {
    return redirect('/login')
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true }
  })
  const userRole = dbUser?.role?.name || 'team_member'

  return <TeamClient initialProfiles={[]} userRole={userRole} />
}
