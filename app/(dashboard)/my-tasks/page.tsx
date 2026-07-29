import TasksClient from '@/components/tasks/tasks-client'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export default async function TasksPage() {
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
    <TasksClient
      initialTasks={[]}
      projects={[]}
      profiles={[]}
      userRole={userRole}
      userId={userId}
    />
  )
}
