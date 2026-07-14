import BoardsClient from '@/components/boards/boards-client'
import { auth } from '@/auth'

export default async function BoardsPage() {
  const session = await auth()
  const userRole = (session?.user as any)?.role || 'team_member'
  const userId = session?.user?.id || ''

  return (
    <BoardsClient
      userRole={userRole}
      userId={userId}
    />
  )
}
