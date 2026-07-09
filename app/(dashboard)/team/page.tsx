import TeamClient from '@/components/team/team-client'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { verifyModuleAccess } from '@/app/actions/access'

export default async function TeamPage() {
  await verifyModuleAccess('team')
  const session = await auth()
  if (!session?.user) {
    return redirect('/login')
  }

  const userRole = (session.user as any)?.role || 'team_member'

  return <TeamClient initialProfiles={[]} userRole={userRole} />
}
