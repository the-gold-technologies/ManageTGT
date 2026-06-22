import TasksClient from '@/components/tasks/tasks-client'
import { auth } from '@/auth'

export default async function TasksPage() {
  const session = await auth()
  const userRole = (session?.user as any)?.role || 'team_member'
  const userId = session?.user?.id || ''

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
