import BoardsClient from '@/components/boards/boards-client'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export default async function BoardsPage() {
  const session = await auth()
  const userId = session?.user?.id || ''
  
  let userRole = 'team_member'
  if (userId) {
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    })
    userRole = dbUser?.role?.name || 'team_member'
  }

  return (
    <BoardsClient
      userRole={userRole}
      userId={userId}
    />
  )
}
