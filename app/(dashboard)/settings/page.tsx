import SettingsClient from '@/components/settings/settings-client'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export default async function SettingsPage() {
  const session = await auth()
  
  const currentProfile = await prisma.user.findUnique({
    where: { id: session?.user?.id || '' }
  })

  const formattedCurrentProfile = currentProfile ? {
    id: currentProfile.id,
    full_name: currentProfile.name || 'User',
    email: currentProfile.email || '',
    role: currentProfile.role,
    avatar_url: currentProfile.image || session?.user?.image || null,
    createdAt: currentProfile.createdAt.toISOString(),
  } : null

  return <SettingsClient currentProfile={formattedCurrentProfile as any} />
}
