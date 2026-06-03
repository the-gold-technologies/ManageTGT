import SettingsClient from '@/components/settings/settings-client'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export default async function SettingsPage() {
  const session = await auth()
  
  const profiles = await prisma.user.findMany({
    orderBy: { name: 'asc' }
  })

  const currentProfile = profiles.find(p => p.id === session?.user?.id)

  const formattedProfiles = profiles.map(p => ({
    id: p.id,
    full_name: p.name || 'User',
    email: p.email || '',
    role: p.role,
    avatar_url: p.image || null,
    createdAt: p.createdAt.toISOString(),
  }))

  const formattedCurrentProfile = currentProfile ? {
    id: currentProfile.id,
    full_name: currentProfile.name || 'User',
    email: currentProfile.email || '',
    role: currentProfile.role,
    avatar_url: currentProfile.image || null,
    createdAt: currentProfile.createdAt.toISOString(),
  } : null

  return <SettingsClient profiles={(formattedProfiles as any) ?? []} currentProfile={formattedCurrentProfile as any} />
}
