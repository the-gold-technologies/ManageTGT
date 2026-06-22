import TeamClient from '@/components/team/team-client'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

export default async function TeamPage() {
  const session = await auth()
  if (!session?.user) {
    return redirect('/login')
  }

  const userRole = (session.user as any)?.role || 'team_member'

  if (!['admin', 'team_lead'].includes(userRole)) {
    return redirect('/')
  }

  return <TeamClient initialProfiles={[]} userRole={userRole} />
}
